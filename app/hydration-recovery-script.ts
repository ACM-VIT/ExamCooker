import {
  HYDRATION_RECOVERY_INCIDENT_KEY,
  RELOAD_FLAG,
  RELOAD_GUARD_TTL_MS,
} from "./global-error-reload-guard";

// React reports #418/#419 hydration mismatches as *recoverable* errors emitted
// *during* the initial hydration pass — before any React `useEffect` runs — so
// a listener attached from a client component would miss the very first blank
// or corrupted viewer of the session. Install the global `error` listener here,
// before hydration, so a mismatch is caught the moment it fires: perform the
// same guarded, one-time `location.reload()` recovery used for `ChunkLoadError`
// (reusing the same reload guard so it can't loop) and record the incident so
// `HydrationRecovery` can report it to PostHog once the page is stable. Kept as
// a string constant (not a regex) so no escaping is mangled when inlined. The
// numbers cover the recoverable hydration error codes React can emit.
export const hydrationRecoveryInitScript = `(function(){try{var FLAG=${JSON.stringify(
  RELOAD_FLAG,
)},INC=${JSON.stringify(
  HYDRATION_RECOVERY_INCIDENT_KEY,
)},TTL=${RELOAD_GUARD_TTL_MS},NUMS={418:1,419:1,420:1,421:1,422:1,423:1,425:1},handled=false;function isHy(m){if(!m)return false;m=''+m;var l=m.toLowerCase();var i=m.indexOf('Minified React error #');if(i!==-1){var n='';for(var j=i+22;j<m.length;j++){var c=m.charCodeAt(j);if(c>=48&&c<=57){n+=m.charAt(j);}else{break;}}if(n&&NUMS[+n])return true;}return l.indexOf('hydrat')!==-1||l.indexOf('did not match')!==-1||l.indexOf('text content does not match')!==-1;}window.addEventListener('error',function(e){if(handled)return;var err=e&&e.error,msg=(err&&err.message)||(e&&e.message)||'';if(!isHy(msg))return;handled=true;var key='hydration:'+((err&&err.name)||'Error')+':'+msg+':'+((err&&err.digest)||''),reload=false;try{var raw=sessionStorage.getItem(FLAG),fresh=false;if(raw){var g=JSON.parse(raw);fresh=!!g&&g.key===key&&(Date.now()-g.timestamp)<TTL;}if(!fresh){sessionStorage.setItem(FLAG,JSON.stringify({key:key,timestamp:Date.now()}));reload=true;}}catch(_){}try{sessionStorage.setItem(INC,JSON.stringify({path:location.pathname,message:(''+msg).slice(0,500),reloadTriggered:reload}));}catch(_){}if(reload){location.reload();}});}catch(_){}})();`;
