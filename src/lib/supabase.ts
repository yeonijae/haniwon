/**
 * Supabase 클라이언트 설정 (관리 시스템)
 * 읽기/쓰기 - 관리자용
 */

import { createClient } from '@supabase/supabase-js';
import type {
  BlogPost,
  BlogPostSummary,
  BlogCategory,
  BlogPostStatus,
} from '@/modules/blog/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============ 포스트 관리 ============

/**
 * 모든 포스트 가져오기 (관리자용 - 모든 상태)
 */
export async function getAllPosts(): Promise<BlogPostSummary[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select(`
      id,
      title,
      slug,
      excerpt,
      category,
      status,
      thumbnail_url,
      author_name,
      published_at,
      created_at,
      updated_at,
      view_count,
      like_count,
      comment_count,
      tags
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching posts:', error);
    throw error;
  }

  return data.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    category: post.category as BlogCategory,
    status: post.status as BlogPostStatus,
    thumbnailUrl: post.thumbnail_url,
    authorName: post.author_name,
    publishedAt: post.published_at,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    viewCount: post.view_count,
    likeCount: post.like_count,
    commentCount: post.comment_count,
    tags: post.tags || [],
  }));
}

/**
 * ID로 포스트 가져오기
 */
export async function getPostById(id: string): Promise<BlogPost | null> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching post:', error);
    return null;
  }

  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    excerpt: data.excerpt,
    content: data.content,
    category: data.category as BlogCategory,
    status: data.status as BlogPostStatus,
    tags: data.tags || [],
    thumbnailUrl: data.thumbnail_url,
    authorName: data.author_name,
    authorTitle: data.author_title,
    publishedAt: data.published_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    viewCount: data.view_count,
    likeCount: data.like_count,
    commentCount: data.comment_count,
    readingTime: data.reading_time,
    metaTitle: data.meta_title,
    metaDescription: data.meta_description,
    ogImage: data.og_image,
  };
}

/**
 * 포스트 생성
 */
export async function createPost(post: Partial<BlogPost>): Promise<BlogPost> {
  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      category: post.category,
      status: post.status || 'draft',
      tags: post.tags || [],
      thumbnail_url: post.thumbnailUrl,
      author_name: post.authorName || '연이재한의원',
      author_title: post.authorTitle || '한의사',
      reading_time: post.readingTime || calculateReadingTime(post.content || ''),
      meta_title: post.metaTitle || post.title,
      meta_description: post.metaDescription || post.excerpt,
      og_image: post.ogImage || post.thumbnailUrl,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating post:', error);
    throw error;
  }

  return mapPostFromDB(data);
}

/**
 * 포스트 수정
 */
export async function updatePost(id: string, post: Partial<BlogPost>): Promise<BlogPost> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (post.title !== undefined) updateData.title = post.title;
  if (post.slug !== undefined) updateData.slug = post.slug;
  if (post.excerpt !== undefined) updateData.excerpt = post.excerpt;
  if (post.content !== undefined) {
    updateData.content = post.content;
    updateData.reading_time = calculateReadingTime(post.content);
  }
  if (post.category !== undefined) updateData.category = post.category;
  if (post.status !== undefined) updateData.status = post.status;
  if (post.tags !== undefined) updateData.tags = post.tags;
  if (post.thumbnailUrl !== undefined) updateData.thumbnail_url = post.thumbnailUrl;
  if (post.authorName !== undefined) updateData.author_name = post.authorName;
  if (post.authorTitle !== undefined) updateData.author_title = post.authorTitle;
  if (post.metaTitle !== undefined) updateData.meta_title = post.metaTitle;
  if (post.metaDescription !== undefined) updateData.meta_description = post.metaDescription;
  if (post.ogImage !== undefined) updateData.og_image = post.ogImage;

  const { data, error } = await supabase
    .from('blog_posts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating post:', error);
    throw error;
  }

  return mapPostFromDB(data);
}

/**
 * 포스트 발행
 */
export async function publishPost(id: string): Promise<BlogPost> {
  const { data, error } = await supabase
    .from('blog_posts')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error publishing post:', error);
    throw error;
  }

  return mapPostFromDB(data);
}

/**
 * 포스트 발행 취소 (임시저장으로)
 */
export async function unpublishPost(id: string): Promise<BlogPost> {
  const { data, error } = await supabase
    .from('blog_posts')
    .update({
      status: 'draft',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error unpublishing post:', error);
    throw error;
  }

  return mapPostFromDB(data);
}

/**
 * 포스트 삭제
 */
export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase
    .from('blog_posts')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
}

// ============ 구독자 관리 ============

/**
 * 모든 구독자 가져오기
 */
export async function getAllSubscribers() {
  const { data, error } = await supabase
    .from('blog_subscribers')
    .select('*')
    .order('subscribed_at', { ascending: false });

  if (error) {
    console.error('Error fetching subscribers:', error);
    throw error;
  }

  return data;
}

/**
 * 구독자 통계
 */
export async function getSubscriberStats() {
  const { data, error } = await supabase
    .from('blog_subscribers')
    .select('subscribe_type, is_active');

  if (error) {
    console.error('Error fetching subscriber stats:', error);
    throw error;
  }

  const total = data.length;
  const active = data.filter((s) => s.is_active).length;
  const kakao = data.filter((s) => s.subscribe_type === 'kakao' || s.subscribe_type === 'both').length;
  const email = data.filter((s) => s.subscribe_type === 'email' || s.subscribe_type === 'both').length;

  return { total, active, kakao, email };
}

// ============ 통계 ============

/**
 * 대시보드 통계
 */
export async function getDashboardStats() {
  const [postsResult, viewsResult, subscribersResult] = await Promise.all([
    supabase.from('blog_posts').select('status, view_count'),
    supabase.from('blog_page_views').select('id').gte('viewed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('blog_subscribers').select('is_active'),
  ]);

  const posts = postsResult.data || [];
  const recentViews = viewsResult.data?.length || 0;
  const subscribers = subscribersResult.data || [];

  return {
    totalPosts: posts.length,
    publishedPosts: posts.filter((p) => p.status === 'published').length,
    draftPosts: posts.filter((p) => p.status === 'draft').length,
    totalViews: posts.reduce((sum, p) => sum + (p.view_count || 0), 0),
    weeklyViews: recentViews,
    totalSubscribers: subscribers.length,
    activeSubscribers: subscribers.filter((s) => s.is_active).length,
  };
}

// ============ 유틸리티 ============

function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const koreanCharsPerMinute = 500;

  const koreanChars = (content.match(/[\uAC00-\uD7AF]/g) || []).length;
  const words = content.split(/\s+/).length;

  const minutes = Math.ceil((koreanChars / koreanCharsPerMinute) + (words / wordsPerMinute));
  return Math.max(1, minutes);
}

function mapPostFromDB(data: Record<string, unknown>): BlogPost {
  return {
    id: data.id as string,
    title: data.title as string,
    slug: data.slug as string,
    excerpt: data.excerpt as string,
    content: data.content as string,
    category: data.category as BlogCategory,
    status: data.status as BlogPostStatus,
    tags: (data.tags as string[]) || [],
    thumbnailUrl: data.thumbnail_url as string | undefined,
    authorName: data.author_name as string,
    authorTitle: data.author_title as string | undefined,
    publishedAt: data.published_at as string | undefined,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    viewCount: data.view_count as number,
    likeCount: data.like_count as number,
    commentCount: data.comment_count as number,
    readingTime: data.reading_time as number | undefined,
    metaTitle: data.meta_title as string | undefined,
    metaDescription: data.meta_description as string | undefined,
    ogImage: data.og_image as string | undefined,
  };
}
