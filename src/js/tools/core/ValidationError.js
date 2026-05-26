/**
 * ValidationError - Provides structured error context for LLM self-correction
 * @module tools/core/ValidationError
 */

export class ValidationError extends Error {
  /**
   * @param {Object} schema - The JSON schema that was used for validation
   * @param {Object} input - The actual input provided
   * @param {Array<{field: string, expected: string, received: string, type: string, hint: string}>} errors
   */
  constructor(schema, input, errors) {
    const message = errors.map(e => e.hint || `${e.field}: ${e.type}`).join('; ');
    super(message);
    this.name = 'ValidationError';
    this.schema = schema;
    this.input = input;
    this.errors = errors;
    this.correctionContext = this._buildCorrectionContext();
  }

  _buildCorrectionContext() {
    return {
      error_type: 'INPUT_VALIDATION_FAILED',
      failed_fields: this.errors.map(e => ({
        field: e.field,
        expected: e.expected,
        received: e.received,
        hint: e.hint || this._getHint(e),
      })),
      schema_snapshot: JSON.stringify(this.schema, null, 2),
      suggested_fix: this._suggestFix(),
    };
  }

  _getHint(error) {
    const hints = {
      required: `Field '${error.field}' is required but missing`,
      type: `Expected ${error.expected} but got ${error.received}`,
      minLength: `Field '${error.field}' must be at least ${error.minLength} characters`,
      maxLength: `Field '${error.field}' must be at most ${error.maxLength} characters`,
      pattern: `Field '${error.field}' does not match required pattern: ${error.pattern}`,
      enum: `Field '${error.field}' must be one of: ${error.allowed?.join(', ') || error.enum?.join(', ')}`,
      minimum: `Field '${error.field}' must be >= ${error.minimum}`,
      maximum: `Field '${error.field}' must be <= ${error.maximum}`,
    };
    return hints[error.type] || error.message || `Validation failed for field '${error.field}'`;
  }

  _suggestFix() {
    const example = {};
    const required = this.schema.required || [];

    for (const key of required) {
      if (!(key in this.input)) {
        const prop = this.schema.properties?.[key];
        example[key] = this._getExampleValue(prop);
      }
    }

    return {
      example,
      instruction: 'Please correct the failed fields according to the schema and retry',
      error_summary: this.message,
    };
  }

  _getExampleValue(prop) {
    if (!prop) return null;

    const examples = {
      string: 'example_string',
      number: 0,
      boolean: false,
      array: [],
      object: {},
    };

    if (prop.example !== undefined) return prop.example;
    if (prop.default !== undefined) return prop.default;
    if (prop.enum && prop.enum.length > 0) return prop.enum[0];

    return examples[prop.type] || null;
  }
}