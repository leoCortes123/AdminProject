'use client';

import { useEffect, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap } from '@codemirror/commands';
import { keymap } from '@codemirror/view';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
}

/**
 * Editor Markdown CodeMirror 6 (F2-T04): controlado, sin save interno.
 * El padre decide cuándo persistir (autosave local con debounce + Guardar).
 */
export function MarkdownEditor({ value, onChange, ariaLabel, placeholder }: MarkdownEditorProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!mountRef.current || viewRef.current) return;
    const state = EditorState.create({
      doc: valueRef.current,
      extensions: [
        markdown(),
        keymap.of(defaultKeymap),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });
    const view = new EditorView({ state, parent: mountRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Sincroniza cambios externos (seleccionar otro documento, restaurar borrador).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return (
    <div
      className="markdown-editor"
      ref={mountRef}
      aria-label={ariaLabel ?? 'Editor Markdown'}
      data-placeholder={placeholder ?? 'Escribe el documento en Markdown…'}
      style={{
        border: '1px solid var(--line-strong)',
        borderRadius: 8,
        overflow: 'auto',
        maxHeight: 420,
        fontSize: 12.5,
        background: '#fff',
      }}
    />
  );
}
