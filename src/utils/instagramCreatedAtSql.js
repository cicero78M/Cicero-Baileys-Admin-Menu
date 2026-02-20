const INSTAGRAM_CREATED_AT_STORAGE_TIMEZONE = 'UTC';
const JAKARTA_TIMEZONE = 'Asia/Jakarta';

export function getInstagramCreatedAtJakartaTimestampSql(columnName = 'created_at') {
  return `((${columnName} AT TIME ZONE '${INSTAGRAM_CREATED_AT_STORAGE_TIMEZONE}') AT TIME ZONE '${JAKARTA_TIMEZONE}')`;
}

export function getInstagramCreatedAtJakartaDateSql(columnName = 'created_at') {
  return `(${getInstagramCreatedAtJakartaTimestampSql(columnName)}::date)`;
}

export function getInstagramNowJakartaDateSql() {
  return `(${getInstagramCreatedAtJakartaTimestampSql('NOW()')}::date)`;
}

export function getNormalizedInstagramSourceTypeSql(columnName = 'source_type') {
  return `REPLACE(REPLACE(COALESCE(LOWER(TRIM(${columnName})), 'cron_fetch'), ' ', '_'), '-', '_')`;
}
