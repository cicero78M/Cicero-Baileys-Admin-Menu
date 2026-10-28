// The switch is deliberately opt-in: enable only after the KEDIRI roster is backfilled.
export function isKediriAmplifierEnabled(clientId) {
  return process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED === 'true' &&
    typeof clientId === 'string' && clientId.trim().toUpperCase() === 'KEDIRI';
}

export function amplificationRole(clientId) {
  return isKediriAmplifierEnabled(clientId) ? 'amplifier' : 'operator';
}

// An explicit client_ids claim is authoritative; never trust a requested role as scope.
export function tokenAllowsClient(user, clientId) {
  const target = typeof clientId === 'string' ? clientId.trim().toUpperCase() : '';
  const ids = Array.isArray(user?.client_ids) ? user.client_ids
    : typeof user?.client_ids === 'string' ? [user.client_ids]
      : user?.client_id ? [user.client_id] : [];
  return !!target && ids.some((id) => typeof id === 'string' && id.trim().toUpperCase() === target);
}

// Additional raw-report visibility guard. It leaves non-KEDIRI rows unchanged.
export function kediriRawReportExclusion(allowKediri, special = false) {
  const eligible = `EXISTS (SELECT 1 FROM "user" ku
    WHERE ku.user_id = r.user_id AND LOWER(ku.client_id) = 'kediri' AND ku.status = true
    AND EXISTS (SELECT 1 FROM user_roles kur JOIN roles kr ON kr.role_id = kur.role_id
      WHERE kur.user_id = ku.user_id AND LOWER(kr.role_name) = 'amplifier'))`;
  const excludedAuthor = allowKediri ? `AND NOT (${eligible})` : '';
  const excludedPost = allowKediri ? `AND NOT (${eligible})` : '';
  const posts = special ? 'insta_post_khusus' : 'insta_post';
  return `NOT EXISTS (SELECT 1 FROM "user" ku WHERE ku.user_id = r.user_id
    AND LOWER(ku.client_id) = 'kediri' ${excludedAuthor})
    AND NOT EXISTS (SELECT 1 FROM ${posts} kp WHERE kp.shortcode = r.shortcode
      AND LOWER(kp.client_id) = 'kediri' ${excludedPost})`;
}

// Mixed-client reports must apply the gate to KEDIRI users too.
export function kediriEligibleUserSql(alias = 'u') {
  if (!isKediriAmplifierEnabled('KEDIRI')) return '1=1';
  return `(LOWER(COALESCE(${alias}.client_id, '')) <> 'kediri' OR
    (${alias}.status = true AND EXISTS (
      SELECT 1 FROM user_roles kar JOIN roles karole ON karole.role_id = kar.role_id
      WHERE kar.user_id = ${alias}.user_id AND LOWER(karole.role_name) = 'amplifier'
    )))`;
}
