/**
 * 위키 모듈 API
 */

import { WikiPage, WikiImage, WikiTreeNode } from '../types';
import { query, queryOne, execute, insert, escapeString } from '@shared/lib/sqlite';

// 모든 페이지 조회 (트리 구조용)
export async function fetchAllPages(): Promise<WikiPage[]> {
  const data = await query<any>(`
    SELECT * FROM wiki_pages ORDER BY display_order ASC, title ASC
  `);
  return data.map((row: any) => ({
    id: row.id,
    title: row.title,
    content: row.content || '',
    parent_id: row.parent_id,
    display_order: row.display_order || 0,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

// 페이지 트리 구조로 변환
export function buildPageTree(pages: WikiPage[]): WikiTreeNode[] {
  const nodeMap = new Map<number, WikiTreeNode>();
  const roots: WikiTreeNode[] = [];

  // 먼저 모든 노드 생성
  pages.forEach(page => {
    nodeMap.set(page.id, {
      id: page.id,
      title: page.title,
      parent_id: page.parent_id,
      display_order: page.display_order,
      children: [],
    });
  });

  // 부모-자식 관계 설정
  pages.forEach(page => {
    const node = nodeMap.get(page.id)!;
    if (page.parent_id && nodeMap.has(page.parent_id)) {
      nodeMap.get(page.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // 각 레벨에서 display_order로 정렬
  const sortChildren = (nodes: WikiTreeNode[]) => {
    nodes.sort((a, b) => a.display_order - b.display_order || a.title.localeCompare(b.title));
    nodes.forEach(node => sortChildren(node.children));
  };
  sortChildren(roots);

  return roots;
}

// 단일 페이지 조회
export async function fetchPage(id: number): Promise<WikiPage | null> {
  const data = await queryOne<any>(`SELECT * FROM wiki_pages WHERE id = ${id}`);
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    content: data.content || '',
    parent_id: data.parent_id,
    display_order: data.display_order || 0,
    created_by: data.created_by,
    updated_by: data.updated_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// 페이지 생성
export async function createPage(page: Omit<WikiPage, 'id' | 'created_at' | 'updated_at'>): Promise<WikiPage> {
  const id = await insert(`
    INSERT INTO wiki_pages (title, content, parent_id, display_order, created_by, updated_by)
    VALUES (${escapeString(page.title)}, ${escapeString(page.content)}, ${page.parent_id ?? 'NULL'}, ${page.display_order}, ${escapeString(page.created_by || '')}, ${escapeString(page.updated_by || '')})
  `);

  const created = await fetchPage(id);
  if (!created) {
    // fallback: title로 조회
    const data = await queryOne<any>(`SELECT * FROM wiki_pages WHERE title = ${escapeString(page.title)} ORDER BY id DESC LIMIT 1`);
    if (data) {
      return {
        id: data.id,
        title: data.title,
        content: data.content || '',
        parent_id: data.parent_id,
        display_order: data.display_order || 0,
        created_by: data.created_by,
        updated_by: data.updated_by,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    }
    throw new Error('페이지 생성 실패');
  }
  return created;
}

// 페이지 수정
export async function updatePage(id: number, page: Partial<WikiPage>): Promise<void> {
  const sets: string[] = [];
  if (page.title !== undefined) sets.push(`title = ${escapeString(page.title)}`);
  if (page.content !== undefined) sets.push(`content = ${escapeString(page.content)}`);
  if (page.parent_id !== undefined) sets.push(`parent_id = ${page.parent_id ?? 'NULL'}`);
  if (page.display_order !== undefined) sets.push(`display_order = ${page.display_order}`);
  if (page.updated_by !== undefined) sets.push(`updated_by = ${escapeString(page.updated_by)}`);
  sets.push(`updated_at = CURRENT_TIMESTAMP`);

  if (sets.length > 0) {
    await execute(`UPDATE wiki_pages SET ${sets.join(', ')} WHERE id = ${id}`);
  }
}

// 페이지 삭제
export async function deletePage(id: number): Promise<void> {
  // 하위 페이지들의 parent_id를 null로 설정 (고아 방지)
  await execute(`UPDATE wiki_pages SET parent_id = NULL WHERE parent_id = ${id}`);
  await execute(`DELETE FROM wiki_pages WHERE id = ${id}`);
}

// 이미지 업로드
export async function uploadImage(pageId: number, filename: string, base64Data: string, mimeType: string): Promise<WikiImage> {
  // Base64 데이터에서 prefix 제거 (data:image/png;base64, 등)
  const cleanData = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

  const id = await insert(`
    INSERT INTO wiki_images (page_id, filename, data, mime_type)
    VALUES (${pageId}, ${escapeString(filename)}, ${escapeString(cleanData)}, ${escapeString(mimeType)})
  `);

  return {
    id,
    page_id: pageId,
    filename,
    data: cleanData,
    mime_type: mimeType,
    created_at: new Date().toISOString(),
  };
}

// 페이지의 이미지 목록 조회
export async function fetchPageImages(pageId: number): Promise<WikiImage[]> {
  const data = await query<any>(`
    SELECT id, page_id, filename, mime_type, created_at FROM wiki_images WHERE page_id = ${pageId}
  `);
  return data.map((row: any) => ({
    id: row.id,
    page_id: row.page_id,
    filename: row.filename,
    data: '', // 목록에서는 데이터 제외
    mime_type: row.mime_type,
    created_at: row.created_at,
  }));
}

// 이미지 조회 (데이터 포함)
export async function fetchImage(id: number): Promise<WikiImage | null> {
  const data = await queryOne<any>(`SELECT * FROM wiki_images WHERE id = ${id}`);
  if (!data) return null;
  return {
    id: data.id,
    page_id: data.page_id,
    filename: data.filename,
    data: data.data,
    mime_type: data.mime_type,
    created_at: data.created_at,
  };
}

// 이미지 삭제
export async function deleteImage(id: number): Promise<void> {
  await execute(`DELETE FROM wiki_images WHERE id = ${id}`);
}

// 페이지 검색
export async function searchPages(keyword: string): Promise<WikiPage[]> {
  const escaped = escapeString(`%${keyword}%`);
  const data = await query<any>(`
    SELECT * FROM wiki_pages
    WHERE title LIKE ${escaped} OR content LIKE ${escaped}
    ORDER BY title ASC
  `);
  return data.map((row: any) => ({
    id: row.id,
    title: row.title,
    content: row.content || '',
    parent_id: row.parent_id,
    display_order: row.display_order || 0,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}
