import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { WikiPage } from '../types';

interface WikiEditorProps {
  page: WikiPage;
  isEditing: boolean;
  onSave: (data: Partial<WikiPage>) => void;
  onCancel: () => void;
  onImageUpload: (file: File) => Promise<string>;
}

function WikiEditor({ page, isEditing, onSave, onCancel, onImageUpload }: WikiEditorProps) {
  const [title, setTitle] = useState(page.title);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'wiki-image',
        },
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'wiki-link',
        },
      }),
      Placeholder.configure({
        placeholder: '내용을 입력하세요...',
      }),
    ],
    content: page.content || '',
    editable: isEditing,
    editorProps: {
      attributes: {
        class: 'wiki-editor-content prose prose-sm max-w-none focus:outline-none',
      },
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer?.files?.length) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            handleImageFile(file);
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) {
                handleImageFile(file);
                return true;
              }
            }
          }
        }
        return false;
      },
    },
  });

  // Update editor content when page changes
  useEffect(() => {
    if (editor && page.content !== editor.getHTML()) {
      editor.commands.setContent(page.content || '');
    }
    setTitle(page.title);
  }, [page, editor]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
    }
  }, [isEditing, editor]);

  const handleImageFile = useCallback(async (file: File) => {
    if (!editor) return;

    try {
      const url = await onImageUpload(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      alert('이미지 업로드에 실패했습니다.');
    }
  }, [editor, onImageUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
    e.target.value = '';
  }, [handleImageFile]);

  const handleSave = useCallback(async () => {
    if (!editor) return;

    setIsSaving(true);
    try {
      await onSave({
        title,
        content: editor.getHTML(),
      });
    } finally {
      setIsSaving(false);
    }
  }, [editor, title, onSave]);

  const handleSetLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL을 입력하세요:', previousUrl);

    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="wiki-editor h-full flex flex-col">
      {/* Title */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-2xl font-bold text-gray-800 border-b-2 border-blue-500 focus:outline-none pb-1"
            placeholder="페이지 제목"
          />
        ) : (
          <h1 className="text-2xl font-bold text-gray-800">{page.title}</h1>
        )}
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span>작성: {page.created_by || '알 수 없음'}</span>
          <span>수정: {page.updated_at ? new Date(page.updated_at).toLocaleDateString('ko-KR') : '-'}</span>
        </div>
      </div>

      {/* Toolbar (Edit mode only) */}
      {isEditing && (
        <div className="px-6 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-1 flex-wrap">
          {/* Text Formatting */}
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
            title="굵게 (Ctrl+B)"
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
            title="기울임 (Ctrl+I)"
          >
            <em>I</em>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`}
            title="취소선"
          >
            <s>S</s>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`toolbar-btn ${editor.isActive('code') ? 'active' : ''}`}
            title="인라인 코드"
          >
            {'</>'}
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Headings */}
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`toolbar-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
            title="제목 1"
          >
            H1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
            title="제목 2"
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`toolbar-btn ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
            title="제목 3"
          >
            H3
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Lists */}
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
            title="글머리 기호"
          >
            •
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
            title="번호 매기기"
          >
            1.
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Block Formatting */}
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
            title="인용"
          >
            "
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`toolbar-btn ${editor.isActive('codeBlock') ? 'active' : ''}`}
            title="코드 블록"
          >
            {'{ }'}
          </button>
          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="toolbar-btn"
            title="구분선"
          >
            —
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Link & Image */}
          <button
            onClick={handleSetLink}
            className={`toolbar-btn ${editor.isActive('link') ? 'active' : ''}`}
            title="링크"
          >
            🔗
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="toolbar-btn"
            title="이미지 업로드"
          >
            🖼️
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex-1" />

          {/* Save/Cancel */}
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      )}

      {/* Bubble Menu (Edit mode only) */}
      {isEditing && editor && (
        <BubbleMenu editor={editor}>
          <div className="bubble-menu bg-gray-800 rounded-lg shadow-lg p-1 flex items-center gap-1">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`bubble-btn ${editor.isActive('bold') ? 'active' : ''}`}
            >
              B
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`bubble-btn ${editor.isActive('italic') ? 'active' : ''}`}
            >
              I
            </button>
            <button
              onClick={handleSetLink}
              className={`bubble-btn ${editor.isActive('link') ? 'active' : ''}`}
            >
              🔗
            </button>
          </div>
        </BubbleMenu>
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-auto px-6 py-4 bg-white">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default WikiEditor;
