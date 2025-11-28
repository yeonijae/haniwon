/**
 * WYSIWYG 블로그 에디터 컴포넌트
 * - TipTap 기반
 * - 이미지 삽입, 서식 적용 지원
 */

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { useCallback, useState, useEffect } from 'react';
import { uploadImageToSupabase } from './ImageUploader';

interface WysiwygEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function WysiwygEditor({ content, onChange, placeholder = '글 내용을 작성하세요...' }: WysiwygEditorProps) {
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto my-4',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-green-600 hover:underline',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Underline,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[500px] px-4 py-3',
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            event.preventDefault();
            const file = items[i].getAsFile();
            if (file) {
              handleImageUpload(file);
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        const file = files[0];
        if (file.type.startsWith('image/')) {
          event.preventDefault();
          handleImageUpload(file);
          return true;
        }
        return false;
      },
    },
  });

  // content가 외부에서 변경되면 에디터 업데이트
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return;

    setUploading(true);
    try {
      const url = await uploadImageToSupabase(file);
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  }, [editor]);

  const addImage = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleImageUpload(file);
      }
    };
    input.click();
  }, [handleImageUpload]);

  const setLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('링크 URL을 입력하세요', previousUrl);

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
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border-b">
        {/* 제목 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('heading', { level: 2 })
              ? 'bg-green-100 text-green-700'
              : 'text-gray-600 hover:bg-gray-200'
          }`}
          title="제목 (H2)"
        >
          <i className="fa-solid fa-heading"></i>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 rounded transition-colors text-sm ${
            editor.isActive('heading', { level: 3 })
              ? 'bg-green-100 text-green-700'
              : 'text-gray-600 hover:bg-gray-200'
          }`}
          title="소제목 (H3)"
        >
          H3
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* 텍스트 서식 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('bold')
              ? 'bg-green-100 text-green-700'
              : 'text-gray-600 hover:bg-gray-200'
          }`}
          title="굵게 (Ctrl+B)"
        >
          <i className="fa-solid fa-bold"></i>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('italic')
              ? 'bg-green-100 text-green-700'
              : 'text-gray-600 hover:bg-gray-200'
          }`}
          title="기울임 (Ctrl+I)"
        >
          <i className="fa-solid fa-italic"></i>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('underline')
              ? 'bg-green-100 text-green-700'
              : 'text-gray-600 hover:bg-gray-200'
          }`}
          title="밑줄 (Ctrl+U)"
        >
          <i className="fa-solid fa-underline"></i>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('strike')
              ? 'bg-green-100 text-green-700'
              : 'text-gray-600 hover:bg-gray-200'
          }`}
          title="취소선"
        >
          <i className="fa-solid fa-strikethrough"></i>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* 목록 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('bulletList')
              ? 'bg-green-100 text-green-700'
              : 'text-gray-600 hover:bg-gray-200'
          }`}
          title="글머리 기호"
        >
          <i className="fa-solid fa-list-ul"></i>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('orderedList')
              ? 'bg-green-100 text-green-700'
              : 'text-gray-600 hover:bg-gray-200'
          }`}
          title="번호 목록"
        >
          <i className="fa-solid fa-list-ol"></i>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('blockquote')
              ? 'bg-green-100 text-green-700'
              : 'text-gray-600 hover:bg-gray-200'
          }`}
          title="인용"
        >
          <i className="fa-solid fa-quote-left"></i>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* 링크 & 이미지 */}
        <button
          type="button"
          onClick={setLink}
          className={`p-2 rounded transition-colors ${
            editor.isActive('link')
              ? 'bg-green-100 text-green-700'
              : 'text-gray-600 hover:bg-gray-200'
          }`}
          title="링크 삽입"
        >
          <i className="fa-solid fa-link"></i>
        </button>
        <button
          type="button"
          onClick={addImage}
          disabled={uploading}
          className="p-2 text-gray-600 hover:bg-green-100 hover:text-green-600 rounded transition-colors disabled:opacity-50"
          title="이미지 삽입"
        >
          {uploading ? (
            <i className="fa-solid fa-spinner animate-spin"></i>
          ) : (
            <i className="fa-solid fa-image"></i>
          )}
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* 구분선 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="p-2 text-gray-600 hover:bg-gray-200 rounded transition-colors"
          title="구분선"
        >
          <i className="fa-solid fa-minus"></i>
        </button>

        {/* 실행 취소/다시 실행 */}
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-2 text-gray-600 hover:bg-gray-200 rounded transition-colors disabled:opacity-30"
          title="실행 취소 (Ctrl+Z)"
        >
          <i className="fa-solid fa-rotate-left"></i>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-2 text-gray-600 hover:bg-gray-200 rounded transition-colors disabled:opacity-30"
          title="다시 실행 (Ctrl+Y)"
        >
          <i className="fa-solid fa-rotate-right"></i>
        </button>
      </div>

      {/* 에디터 */}
      <div className="relative">
        <EditorContent editor={editor} />
        {uploading && (
          <div className="absolute top-2 right-2 flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded-full text-sm">
            <i className="fa-solid fa-spinner animate-spin"></i>
            이미지 업로드 중...
          </div>
        )}
      </div>

      {/* 안내 */}
      <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500">
        <i className="fa-solid fa-lightbulb mr-1"></i>
        Ctrl+V로 이미지 붙여넣기 | 드래그하여 이미지 삽입 | Ctrl+B 굵게 | Ctrl+I 기울임
      </div>
    </div>
  );
}
