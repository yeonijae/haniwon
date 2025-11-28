/**
 * HTML 코드 에디터 컴포넌트 (CodeMirror 기반)
 * - 구문 강조
 * - 자동 완성
 * - 다크 테마
 */

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { autocompletion, closeBrackets } from '@codemirror/autocomplete';

interface HtmlCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export interface HtmlCodeEditorRef {
  insertText: (text: string) => void;
  focus: () => void;
}

const HtmlCodeEditor = forwardRef<HtmlCodeEditorRef, HtmlCodeEditorProps>(
  ({ value, onChange, className = '' }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    useImperativeHandle(ref, () => ({
      insertText: (text: string) => {
        if (viewRef.current) {
          const view = viewRef.current;
          const { from, to } = view.state.selection.main;
          view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length },
          });
          view.focus();
        }
      },
      focus: () => {
        viewRef.current?.focus();
      },
    }));

    useEffect(() => {
      if (!editorRef.current) return;

      const state = EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          history(),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          html(),
          oneDark,
          syntaxHighlighting(defaultHighlightStyle),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping, // 자동 줄바꿈
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString());
            }
          }),
          EditorView.theme({
            '&': {
              height: '100%',
              fontSize: '14px',
            },
            '.cm-scroller': {
              overflow: 'auto',
              fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
            },
            '.cm-content': {
              padding: '12px 0',
            },
            '.cm-line': {
              padding: '0 12px',
            },
            '.cm-gutters': {
              backgroundColor: '#21252b',
              color: '#636d83',
              border: 'none',
            },
            '.cm-activeLineGutter': {
              backgroundColor: '#2c313c',
            },
          }),
        ],
      });

      const view = new EditorView({
        state,
        parent: editorRef.current,
      });

      viewRef.current = view;

      return () => {
        view.destroy();
      };
    }, []);

    // 외부에서 value가 변경되면 에디터 내용 업데이트
    useEffect(() => {
      if (viewRef.current) {
        const currentValue = viewRef.current.state.doc.toString();
        if (value !== currentValue) {
          viewRef.current.dispatch({
            changes: {
              from: 0,
              to: currentValue.length,
              insert: value,
            },
          });
        }
      }
    }, [value]);

    return (
      <div
        ref={editorRef}
        className={`h-full overflow-hidden ${className}`}
      />
    );
  }
);

HtmlCodeEditor.displayName = 'HtmlCodeEditor';

export default HtmlCodeEditor;
