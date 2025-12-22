// 위키 모듈 타입 정의

export interface WikiPage {
  id: number;
  title: string;
  content: string;
  parent_id: number | null;
  display_order: number;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  children?: WikiPage[];
}

export interface WikiImage {
  id: number;
  page_id: number;
  filename: string;
  data: string; // Base64 encoded
  mime_type: string;
  created_at: string;
}

export interface WikiTreeNode {
  id: number;
  title: string;
  parent_id: number | null;
  display_order: number;
  children: WikiTreeNode[];
}
