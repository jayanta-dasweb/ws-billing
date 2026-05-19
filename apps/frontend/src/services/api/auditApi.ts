import type {
  ActivityLogDto,
  ActivityLogFilters,
  ActivityLogListResult,
  AuditSeverity,
  AuditSource,
} from '@billing/shared';
import { baseApi } from './baseApi';
import { getApiBaseUrl } from '@/lib/apiBase';
import { unwrapApi } from '@/utils/api';

export type { ActivityLogDto, ActivityLogFilters, ActivityLogListResult };

export const auditApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    listActivityLogs: builder.query<ActivityLogListResult, ActivityLogFilters>({
      query: (params) => ({ url: '/audit/logs', params }),
      transformResponse: (r) => unwrapApi<ActivityLogListResult>(r),
      providesTags: ['Audit'],
    }),
    getActivityLog: builder.query<ActivityLogDto, string>({
      query: (id) => `/audit/logs/${id}`,
      transformResponse: (r) => unwrapApi<ActivityLogDto>(r),
    }),
    getActivityTimeline: builder.query<
      { data: ActivityLogDto[] },
      { subjectType: string; subjectId: string }
    >({
      query: ({ subjectType, subjectId }) => ({
        url: '/audit/timeline',
        params: { subjectType, subjectId },
      }),
      transformResponse: (r) => unwrapApi<{ data: ActivityLogDto[] }>(r),
    }),
    getAuditFilterMeta: builder.query<{ modules: string[]; actions: string[] }, void>({
      query: () => '/audit/meta/filters',
      transformResponse: (r) => unwrapApi<{ modules: string[]; actions: string[] }>(r),
    }),
  }),
});

export const {
  useListActivityLogsQuery,
  useGetActivityLogQuery,
  useGetActivityTimelineQuery,
  useGetAuditFilterMetaQuery,
} = auditApi;

/** CSV export (opens download in new tab with auth from cookie + token in query not supported — use fetch) */
export async function downloadAuditCsv(
  filters: ActivityLogFilters,
  accessToken: string | null,
): Promise<void> {
  const q = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v));
  });
  const res = await fetch(`${getApiBaseUrl()}/audit/logs/export?${q}`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export { AuditSeverity, AuditSource };
