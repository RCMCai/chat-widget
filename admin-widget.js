
/**
 * RapidReply Admin Widget (Agent)
 * Sends messages into public.messagesrr for a given session.
 * Assumes window.supabaseClient is available (or define SUPABASE_URL/ANON_KEY before this script).
 */

(function(){
  var SUPABASE_URL = window.SUPABASE_URL || null;
  var SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || null;
  if (!window.supabaseClient) {
    if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
      window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.warn('[RR Admin] Supabase client not found. Provide SUPABASE_URL/ANON_KEY and supabase-js.');
    }
  }

  var USERID = window.RAPIDREPLY_USERID || document.documentElement.getAttribute('data-rr-userid') || null;

  function sendAgentMessage(sessionId, text) {
    if (!window.supabaseClient) return;
    if (!sessionId || !text) return;
    var row = {
      userid: USERID,
      sessionid: sessionId,
      sender: 'agent',
      text: text,
      timestamp: new Date().toISOString(),
      read: false,
    };
    return window.supabaseClient.from('messagesrr').insert(row);
  }

  // Optional: expose simple API for your admin UI
  window.RapidReplyAdmin = {
    send: sendAgentMessage
  };
})();
