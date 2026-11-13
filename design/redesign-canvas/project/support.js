/*
 * Minimal local runtime for the .dc.html design boards.
 * The original canvas runtime was not part of the handoff, so this file
 * re-implements just what the boards use: {{expr}} bindings, <sc-for>,
 * <sc-if>, <helmet>, on* handlers and a DCLogic base class with setState.
 * Props come from data-props defaults; override with ?dark=1, ?dark=0 or #dark.
 */
(function () {
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) {
      const next = typeof patch === 'function' ? patch(this.state) : patch;
      this.state = Object.assign({}, this.state, next);
      if (this.__render) this.__render();
    }
    renderVals() { return {}; }
  }
  window.DCLogic = DCLogic;

  // Expressions are plain paths (a.b.c) or true/false, so no code is evaluated.
  function evalExpr(expr, scope) {
    const e = expr.trim();
    if (e === 'true') return true;
    if (e === 'false') return false;
    let v = scope;
    for (const k of e.split('.')) {
      if (v == null) return undefined;
      v = v[k];
    }
    return v;
  }

  const SINGLE = /^\s*\{\{([\s\S]+?)\}\}\s*$/;
  const ANY = /\{\{([\s\S]+?)\}\}/g;

  function interpolate(str, scope) {
    return str.replace(ANY, (_, e) => {
      const v = evalExpr(e, scope);
      return v == null || v === false ? '' : String(v);
    });
  }

  const EVENT_MAP = { change: 'input' }; // React-style onChange fires on every keystroke

  function renderNode(node, scope, out) {
    if (node.nodeType === 3) {
      const t = node.nodeValue;
      out.appendChild(document.createTextNode(t.indexOf('{{') >= 0 ? interpolate(t, scope) : t));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.localName;

    if (tag === 'sc-for') {
      const m = SINGLE.exec(node.getAttribute('list') || '');
      const list = m ? evalExpr(m[1], scope) : [];
      const as = node.getAttribute('as') || 'item';
      (Array.isArray(list) ? list : []).forEach((item, i) => {
        const child = Object.create(scope);
        child[as] = item;
        child.$index = i;
        node.childNodes.forEach((c) => renderNode(c, child, out));
      });
      return;
    }
    if (tag === 'sc-if') {
      const m = SINGLE.exec(node.getAttribute('value') || '');
      if (m && evalExpr(m[1], scope)) node.childNodes.forEach((c) => renderNode(c, scope, out));
      return;
    }
    if (tag === 'helmet') return;

    const el = node.cloneNode(false);
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name;
      const val = attr.value;
      if (name.startsWith('hint-placeholder')) { el.removeAttribute(name); continue; }
      if (val.indexOf('{{') < 0) continue;
      const single = SINGLE.exec(val);
      if (name.startsWith('on') && single) {
        el.removeAttribute(name);
        const fn = evalExpr(single[1], scope);
        const evt = name.slice(2).toLowerCase();
        if (typeof fn === 'function') el.addEventListener(EVENT_MAP[evt] || evt, fn);
        continue;
      }
      if ((name === 'value' || name === 'checked') && single) {
        const v = evalExpr(single[1], scope);
        el.removeAttribute(name);
        if (name === 'checked') { el.checked = !!v; if (v) el.setAttribute('checked', ''); }
        else { el.value = v == null ? '' : v; el.setAttribute('value', v == null ? '' : v); }
        continue;
      }
      if (single) {
        const v = evalExpr(single[1], scope);
        if (v === false || v == null) { el.removeAttribute(name); continue; }
        el.setAttribute(name, v === true ? '' : String(v));
        continue;
      }
      el.setAttribute(name, interpolate(val, scope));
    }
    node.childNodes.forEach((c) => renderNode(c, scope, el));
    out.appendChild(el);
  }

  function boot() {
    const host = document.querySelector('x-dc');
    if (!host) return;
    const tpl = document.createElement('div');
    tpl.innerHTML = host.innerHTML;

    const helmet = tpl.querySelector('helmet');
    if (helmet) {
      Array.from(helmet.childNodes).forEach((n) => document.head.appendChild(n));
      helmet.remove();
    }

    const script = document.querySelector('script[data-dc-script]');
    let props = {};
    let Comp = DCLogic;
    if (script) {
      try {
        const spec = JSON.parse(script.getAttribute('data-props') || '{}');
        Object.keys(spec).forEach((k) => {
          if (k[0] !== '$' && spec[k] && 'default' in spec[k]) props[k] = spec[k].default;
        });
      } catch (e) { /* ignore bad props */ }
      // Run the board's logic as an ordinary inline script, then pick up its Component class.
      const run = document.createElement('script');
      run.textContent = script.textContent + '\n;window.__dcComp = typeof Component !== "undefined" ? Component : null;';
      document.head.appendChild(run);
      Comp = window.__dcComp || DCLogic;
    }
    const q = new URLSearchParams(location.search);
    q.forEach((v, k) => { props[k] = v === '1' || v === 'true' ? true : v === '0' || v === 'false' ? false : v; });
    if (location.hash === '#dark') props.dark = true;

    const comp = new Comp(props);
    const mount = document.createElement('div');
    mount.className = 'dc-root';
    host.replaceWith(mount);

    comp.__render = function () {
      const inputs = Array.from(mount.querySelectorAll('input,textarea,select'));
      const active = document.activeElement;
      const idx = inputs.indexOf(active);
      const sel = idx >= 0 && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;

      const scope = Object.assign(Object.create(null), comp.renderVals() || {});
      const frag = document.createDocumentFragment();
      tpl.childNodes.forEach((c) => renderNode(c, scope, frag));
      mount.replaceChildren(frag);

      if (idx >= 0) {
        const next = mount.querySelectorAll('input,textarea,select')[idx];
        if (next) {
          next.focus();
          if (sel) { try { next.setSelectionRange(sel[0], sel[1]); } catch (e) { /* not a text input */ } }
        }
      }
    };
    comp.__render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
