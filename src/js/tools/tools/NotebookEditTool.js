/**
 * Notebook Edit Tool - Edit Jupyter notebook cells
 * @module tools/tools/NotebookEditTool
 */

import { TOOL_ACCESS_MODE } from '../core/Tool.js';
import { expandPath, validatePathSecurity } from '../utils/pathSecurity.js';
import fs from 'node:fs/promises';

/**
 * Parse cell ID from string
 */
function parseCellId(cellId) {
  return cellId || null;
}

/**
 * Generate a unique cell ID
 */
function generateCellId() {
  return 'cell-' + Math.random().toString(36).slice(2, 10);
}

/**
 * Read and parse a notebook file
 */
async function readNotebook(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error(`Notebook not found: ${filePath}`);
    throw new Error(`Failed to read notebook: ${e.message}`);
  }
}

/**
 * Write notebook with atomic write
 */
async function writeNotebook(filePath, notebook) {
  const tempPath = filePath + '.nb edit.tmp.' + Date.now();
  try {
    await fs.writeFile(tempPath, JSON.stringify(notebook, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);
  } catch (e) {
    try { await fs.unlink(tempPath); } catch {}
    throw e;
  }
}

export const NotebookEditTool = {
  name: 'notebook_edit',
  description: '编辑 Jupyter notebook 的 cell',
  inputSchema: {
    type: 'object',
    properties: {
      notebook_path: {
        type: 'string',
        description: 'Notebook 文件路径（必须是 .ipynb）',
      },
      cell_id: {
        type: 'string',
        optional: true,
        description: '要编辑的 cell ID',
      },
      new_source: {
        type: 'string',
        description: 'cell 的新内容',
      },
      cell_type: {
        type: 'string',
        enum: ['code', 'markdown'],
        optional: true,
        description: 'cell 类型',
      },
      edit_mode: {
        type: 'string',
        enum: ['replace', 'insert', 'delete'],
        optional: true,
        description: '编辑模式：replace（替换）, insert（插入）, delete（删除）',
      },
    },
    required: ['notebook_path', 'new_source'],
  },
  accessMode: TOOL_ACCESS_MODE.WRITE,
  timeout: 30000,
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => false,
  getResourceId: (args) => 'notebook:' + args.notebook_path,

  async call(args, options = {}) {
    const cwd = options.context?.cwd || process.cwd();
    const {
      notebook_path,
      cell_id,
      new_source,
      cell_type,
      edit_mode = 'replace',
    } = args;

    // Validate file extension
    if (!notebook_path.endsWith('.ipynb')) {
      return {
        success: false,
        error: 'File must be a Jupyter notebook (.ipynb)',
      };
    }

    const filePath = expandPath(notebook_path, cwd);

    // Security check
    const securityCheck = validatePathSecurity(filePath);
    if (!securityCheck.valid) {
      return { success: false, error: securityCheck.error };
    }

    // Read notebook
    let notebook;
    try {
      notebook = await readNotebook(filePath);
    } catch (e) {
      return { success: false, error: e.message };
    }

    if (!notebook.cells || !Array.isArray(notebook.cells)) {
      return { success: false, error: 'Invalid notebook format' };
    }

    const originalFile = JSON.stringify(notebook);
    let updatedCellId = cell_id || null;
    let resultCell = null;

    switch (edit_mode) {
      case 'replace': {
        // Find cell by ID or use last cell
        let cellIndex = -1;
        if (cell_id) {
          cellIndex = notebook.cells.findIndex((c) => c.id === cell_id);
        }
        if (cellIndex === -1) {
          cellIndex = notebook.cells.length - 1;
        }

        if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
          return { success: false, error: 'Cell not found' };
        }

        const targetCell = notebook.cells[cellIndex];
        if (cell_type) targetCell.cell_type = cell_type;
        targetCell.source = new_source.split('\n').map((line) => line + '\n');
        targetCell.execution_count = null; // Reset execution count
        updatedCellId = targetCell.id;
        resultCell = targetCell;
        break;
      }

      case 'insert': {
        // Insert after cell_id, or at beginning
        const newCell = {
          id: generateCellId(),
          cell_type: cell_type || 'code',
          source: new_source.split('\n').map((line) => line + '\n'),
          outputs: [],
          execution_count: null,
          metadata: {},
        };

        if (cell_id) {
          const insertIndex = notebook.cells.findIndex((c) => c.id === cell_id);
          if (insertIndex >= 0) {
            notebook.cells.splice(insertIndex + 1, 0, newCell);
          } else {
            notebook.cells.unshift(newCell);
          }
        } else {
          notebook.cells.unshift(newCell);
        }
        updatedCellId = newCell.id;
        resultCell = newCell;
        break;
      }

      case 'delete': {
        if (!cell_id) {
          return { success: false, error: 'cell_id required for delete mode' };
        }
        const deleteIndex = notebook.cells.findIndex((c) => c.id === cell_id);
        if (deleteIndex < 0) {
          return { success: false, error: 'Cell not found' };
        }
        notebook.cells.splice(deleteIndex, 1);
        updatedCellId = cell_id;
        break;
      }

      default:
        return { success: false, error: `Unknown edit mode: ${edit_mode}` };
    }

    // Write updated notebook
    try {
      await writeNotebook(filePath, notebook);
    } catch (e) {
      return { success: false, error: `Failed to write notebook: ${e.message}` };
    }

    // Detect language from kernel
    const language =
      notebook.metadata?.kernelspec?.language ||
      notebook.metadata?.language_info?.name ||
      'python';

    return {
      success: true,
      cell_id: updatedCellId,
      cell_type: resultCell?.cell_type || cell_type || 'code',
      language,
      edit_mode,
      notebook_path: filePath,
      message:
        edit_mode === 'delete'
          ? `Deleted cell ${updatedCellId}`
          : edit_mode === 'insert'
            ? `Inserted cell ${updatedCellId}`
            : `Updated cell ${updatedCellId}`,
    };
  },
};