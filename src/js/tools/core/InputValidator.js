/**
 * Schema-based Input Validator
 * @module tools/core/InputValidator
 */

import { ValidationError } from './ValidationError.js';

/**
 * @param {Object} schema - JSON Schema like object
 * @param {Object} input - Input to validate
 * @returns {{ valid: boolean, errors: Array, data: Object }}
 */
export function validateInput(schema, input) {
  const errors = [];

  if (!schema || typeof schema !== 'object') {
    return { valid: true, errors: [], data: input };
  }

  if (schema.type && !_checkType(input, schema.type)) {
    errors.push({
      field: '__root__',
      type: 'type',
      expected: schema.type,
      received: _getType(input),
      hint: `Input must be of type ${schema.type}`,
    });
    return { valid: false, errors, data: null };
  }

  if (schema.type === 'object' || schema.properties) {
    _validateObject(schema, input || {}, errors);
  } else if (schema.type === 'array') {
    _validateArray(schema, input || [], errors);
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? input : null,
  };
}

function _checkType(value, expectedType) {
  if (value === null || value === undefined) return true;
  const actualType = _getType(value);
  return actualType === expectedType;
}

function _getType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function _validateObject(schema, input, errors) {
  const required = schema.required || [];

  for (const field of required) {
    if (!(field in input) || input[field] === undefined || input[field] === null) {
      errors.push({
        field,
        type: 'required',
        expected: 'any',
        received: 'undefined',
        hint: `Field '${field}' is required but missing`,
      });
    }
  }

  const properties = schema.properties || {};

  for (const [field, rules] of Object.entries(properties)) {
    const value = input[field];

    if (value === undefined || value === null) continue;

    if (rules.type) {
      const typeOk = _checkType(value, rules.type);
      if (!typeOk) {
        errors.push({
          field,
          type: 'type',
          expected: rules.type,
          received: _getType(value),
          hint: `Field '${field}' expected ${rules.type}, got ${_getType(value)}`,
        });
      }
    }

    if (rules.minLength !== undefined && typeof value === 'string' && value.length < rules.minLength) {
      errors.push({
        field,
        type: 'minLength',
        expected: `length >= ${rules.minLength}`,
        received: `length = ${value.length}`,
        hint: `Field '${field}' must be at least ${rules.minLength} characters`,
      });
    }

    if (rules.maxLength !== undefined && typeof value === 'string' && value.length > rules.maxLength) {
      errors.push({
        field,
        type: 'maxLength',
        expected: `length <= ${rules.maxLength}`,
        received: `length = ${value.length}`,
        hint: `Field '${field}' must be at most ${rules.maxLength} characters`,
      });
    }

    if (rules.pattern && typeof value === 'string' && !new RegExp(rules.pattern).test(value)) {
      errors.push({
        field,
        type: 'pattern',
        expected: rules.pattern,
        received: value,
        hint: `Field '${field}' does not match required pattern: ${rules.pattern}`,
      });
    }

    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({
        field,
        type: 'enum',
        expected: rules.enum.join(' | '),
        received: value,
        hint: `Field '${field}' must be one of: ${rules.enum.join(', ')}`,
      });
    }

    if (rules.minimum !== undefined && typeof value === 'number' && value < rules.minimum) {
      errors.push({
        field,
        type: 'minimum',
        expected: `>= ${rules.minimum}`,
        received: value,
        hint: `Field '${field}' must be >= ${rules.minimum}`,
      });
    }

    if (rules.maximum !== undefined && typeof value === 'number' && value > rules.maximum) {
      errors.push({
        field,
        type: 'maximum',
        expected: `<= ${rules.maximum}`,
        received: value,
        hint: `Field '${field}' must be <= ${rules.maximum}`,
      });
    }
  }
}

function _validateArray(schema, input, errors) {
  if (!Array.isArray(input)) return;

  if (schema.minItems !== undefined && input.length < schema.minItems) {
    errors.push({
      field: '__root__',
      type: 'minItems',
      expected: `length >= ${schema.minItems}`,
      received: `length = ${input.length}`,
      hint: `Array must have at least ${schema.minItems} items`,
    });
  }

  if (schema.maxItems !== undefined && input.length > schema.maxItems) {
    errors.push({
      field: '__root__',
      type: 'maxItems',
      expected: `length <= ${schema.maxItems}`,
      received: `length = ${input.length}`,
      hint: `Array must have at most ${schema.maxItems} items`,
    });
  }
}

export class InputValidator {
  /**
   * @param {Object} schema
   */
  constructor(schema) {
    this.schema = schema;
  }

  /**
   * @param {Object} input
   * @returns {{ valid: boolean, errors: Array }}
   */
  validate(input) {
    return validateInput(this.schema, input);
  }

  /**
   * Throws ValidationError if invalid
   * @param {Object} input
   * @returns {Object} validated input
   */
  validateOrThrow(input) {
    const result = this.validate(input);
    if (!result.valid) {
      throw new ValidationError(this.schema, input, result.errors);
    }
    return result.data;
  }
}