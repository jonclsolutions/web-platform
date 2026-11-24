/**
 * @file seo-route-data.ts
 * @path src/app/shared/utils/seo-route-data.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Route data of the public pages for search engines, kept apart from SeoService so
 *   that the eagerly loaded route definitions do not pull the service into the initial bundle.
 * @dependencies none.
 * @usage `data: { [SEO_NOINDEX_DATA]: true }` on a route search engines should not list (404,
 *   maintenance) - SeoService then sets `<meta name="robots" content="noindex">` and leaves out
 *   the language versions (hreflang).
 */

/** @description Route data key: `true` = the page should not be listed by search engines. */
export const SEO_NOINDEX_DATA = 'seoNoindex';
