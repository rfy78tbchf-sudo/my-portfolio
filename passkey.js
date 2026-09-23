// First-party WebAuthn bridge for Supabase Auth's documented two-step passkey API.
// Tokens are only sent to the existing Supabase project, never to a CDN.
const url = 'https://buimrsjowlmfkxxaithj.supabase.co/auth/v1';
const publishable = 'sb_publishable_PtqyNbOvFTVbPwtwZB6-rQ_bbzKHZfv';
function base64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(x => { binary += String.fromCharCode(x); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64url(value) {
  const v = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(v.padEnd(Math.ceil(v.length / 4) * 4, '='));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function request(path, body, token) {
  const headers = {'Content-Type': 'application/json', apikey: publishable};
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(url + path, {method:'POST',headers,body:JSON.stringify(body || {})});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.msg || data.message || data.error_description || 'Face ID 인증에 실패했습니다.');
    error.code = data.error_code || data.code || '';
    throw error;
  }
  return data;
}
function credentialJSON(credential) {
  // Safari's PublicKeyCredential.toJSON() is preferred when available.
  if (typeof credential.toJSON === 'function') return credential.toJSON();
  const response = credential.response;
  const fields = {clientDataJSON:base64url(response.clientDataJSON)};
  if (response.attestationObject) {
    fields.attestationObject = base64url(response.attestationObject);
    if (response.getTransports) fields.transports = response.getTransports();
  } else {
    fields.authenticatorData = base64url(response.authenticatorData);
    fields.signature = base64url(response.signature);
    fields.userHandle = response.userHandle ? base64url(response.userHandle) : null;
  }
  return {id:credential.id,rawId:base64url(credential.rawId),type:credential.type,
    authenticatorAttachment:credential.authenticatorAttachment || undefined,
    response:fields,clientExtensionResults:credential.getClientExtensionResults()};
}
function registrationOptions(options) {
  return {...options,challenge:fromBase64url(options.challenge),
    user:{...options.user,id:fromBase64url(options.user.id)},
    excludeCredentials:(options.excludeCredentials||[]).map(x => ({...x,id:fromBase64url(x.id)}))};
}
function authenticationOptions(options) {
  return {...options,challenge:fromBase64url(options.challenge),
    allowCredentials:(options.allowCredentials||[]).map(x => ({...x,id:fromBase64url(x.id)}))};
}
window.portfolioPasskeys = {
  async register(accessToken) {
    const start = await request('/passkeys/registration/options', {}, accessToken);
    const credential = await navigator.credentials.create({publicKey:registrationOptions(start.options)});
    if (!credential) throw new Error('iPhone에서 등록을 취소했습니다.');
    return request('/passkeys/registration/verify',
      {challenge_id:start.challenge_id,credential:credentialJSON(credential)},accessToken);
  },
  async signIn() {
    const start = await request('/passkeys/authentication/options', {});
    const credential = await navigator.credentials.get({publicKey:authenticationOptions(start.options)});
    if (!credential) throw new Error('iPhone에서 인증을 취소했습니다.');
    const result = await request('/passkeys/authentication/verify',
      {challenge_id:start.challenge_id,credential:credentialJSON(credential)});
    return result.session || result;
  },
  async status() {
    try { await request('/passkeys/authentication/options', {}); return true; }
    catch (error) {
      if (error.code === 'passkey_disabled') return false;
      throw error;
    }
  }
};
if (window.isSecureContext && window.PublicKeyCredential) {
  window.portfolioPasskeys.status().then(enabled => {
    window.portfolioPasskeyState = enabled ? 'ready' : 'disabled';
    window.dispatchEvent(new Event(enabled ? 'portfolio-passkey-ready' : 'portfolio-passkey-disabled'));
  }).catch(error => {
    window.portfolioPasskeyLoadError = error;
    window.dispatchEvent(new Event('portfolio-passkey-error'));
  });
} else {
  window.portfolioPasskeyState = 'unsupported';
  window.dispatchEvent(new Event('portfolio-passkey-error'));
}
