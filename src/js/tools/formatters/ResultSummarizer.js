/**
 * Result Summarizer - Protects LLM context window from large tool outputs
 * @module tools/formatters/ResultSummarizer
 */

export const CONTEXT_LIMITS = {
  MAX_RESULT_SIZE_KB: 8,
  MAX_ITEMS_TO_KEEP: 10,
  MAX_ITEM_PREVIEW_CHARS: 200,
  MAX_TOTAL_PREVIEW_KB: 4,
};

export class ResultSummarizer {
  constructor(options = {}) {
    this.maxSizeKB = options.maxSizeKB ?? CONTEXT_LIMITS.MAX_RESULT_SIZE_KB;
    this.maxItems = options.maxItems ?? CONTEXT_LIMITS.MAX_ITEMS_TO_KEEP;
    this.maxPreviewChars = options.maxPreviewChars ?? CONTEXT_LIMITS.MAX_ITEM_PREVIEW_CHARS;
  }

  /**
   * Summarize result if it exceeds size threshold
   * @param {*} result - Raw tool result
   * @returns {{original: string, summarized: boolean, sizeKB: number, summary?: *, metadata: Object}}
   */
  summarize(result) {
    const stringified = typeof result === 'string' ? result : JSON.stringify(result);
    const sizeKB = new Blob([stringified]).size / 1024;

    if (sizeKB <= this.maxSizeKB) {
      return {
        original: stringified,
        summarized: false,
        sizeKB,
        metadata: { preserved: true },
      };
    }

    // Parse back if JSON for structured summarization
    let parsed = result;
    try {
      parsed = JSON.parse(stringified);
    } catch {
      // Not JSON, treat as text
    }

    const summary = this._summarize(parsed, stringified);

    return {
      original: stringified,
      summarized: true,
      sizeKB,
      summary,
      metadata: {
        originalSizeKB: sizeKB,
        strategy: summary._strategy,
        truncatedItems: this._countItems(parsed),
      },
    };
  }

  _summarize(parsed, raw) {
    if (Array.isArray(parsed)) {
      return this._summarizeArray(parsed);
    }

    if (typeof parsed === 'object' && parsed !== null) {
      return this._summarizeObject(parsed);
    }

    return this._summarizeText(raw);
  }

  _summarizeArray(arr) {
    const truncated = arr.slice(0, this.maxItems);
    const previews = truncated.map(item => this._itemPreview(item));

    return {
      _type: 'truncated_array',
      _strategy: 'array_truncate',
      _total: arr.length,
      _preserved: this.maxItems,
      items: previews,
      _note: `${arr.length - this.maxItems} additional items omitted. Full result available.`,
    };
  }

  _summarizeObject(obj) {
    // Find largest array field
    let largestArrayKey = null;
    let largestArrayLen = 0;

    for (const [key, val] of Object.entries(obj)) {
      if (Array.isArray(val) && val.length > largestArrayLen) {
        largestArrayLen = val.length;
        largestArrayKey = key;
      }
    }

    if (largestArrayKey && largestArrayLen > this.maxItems) {
      return {
        ...obj,
        [largestArrayKey]: this._truncateArrayField(obj[largestArrayKey]),
        _summary: `Array '${largestArrayKey}' had ${largestArrayLen} items, showing first ${this.maxItems}`,
        _strategy: 'keyed_array_truncate',
      };
    }

    return this._summarizeObjectFields(obj);
  }

  _summarizeObjectFields(obj) {
    const result = {};
    let currentSize = 0;
    const maxSize = this.maxSizeKB * 512;

    const entries = Object.entries(obj);
    for (const [key, val] of entries) {
      const valStr = JSON.stringify(val);
      if (currentSize + valStr.length > maxSize && Object.keys(result).length > 0) {
        result[key + '_truncated'] = true;
        result[key + '_preview'] = String(val).slice(0, 200);
      } else {
        result[key] = val;
        currentSize += valStr.length;
      }
    }

    result._strategy = 'object_fields_truncate';
    return result;
  }

  _summarizeText(text) {
    const maxChars = this.maxSizeKB * 512;
    return {
      _type: 'truncated_text',
      _strategy: 'text_truncate',
      _original_length: text.length,
      _preserved_length: maxChars,
      content: text.slice(0, maxChars),
      _note: `${text.length - maxChars} characters omitted`,
    };
  }

  _truncateArrayField(arr) {
    const truncated = arr.slice(0, this.maxItems);
    return {
      _type: 'truncated_array_field',
      _total: arr.length,
      _preserved: this.maxItems,
      items: truncated.map(item => this._itemPreview(item)),
      _note: `${arr.length - this.maxItems} items omitted`,
    };
  }

  _itemPreview(item) {
    if (typeof item === 'string') {
      return item.slice(0, this.maxPreviewChars);
    }
    if (typeof item === 'object' && item !== null) {
      const str = JSON.stringify(item);
      return str.slice(0, this.maxPreviewChars);
    }
    return String(item).slice(0, this.maxPreviewChars);
  }

  _countItems(result) {
    if (Array.isArray(result)) return result.length;

    if (typeof result === 'object' && result !== null) {
      for (const val of Object.values(result)) {
        if (Array.isArray(val)) return val.length;
      }
    }

    return 1;
  }
}

export const resultSummarizer = new ResultSummarizer();