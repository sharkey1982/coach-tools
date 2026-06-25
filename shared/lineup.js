/* ============================================================================
   Coach Tools · Lineup v1.0
   Per-discipline "planning basket" of activity ids, backed by localStorage.

   Each discipline keeps its own list. Single-device, no sync; cross-tab updates
   propagate via the storage event so two open tabs of the same discipline stay
   in sync.

   Public API:
     window.Lineup.forDiscipline(disciplineId) -> {
       getAll()        : returns array of activity ids (in insertion order)
       has(id)         : boolean
       add(id)         : adds if not present
       remove(id)      : removes if present
       toggle(id)      : adds if absent, removes if present
       clear()         : empties the list
       count()         : number of ids
       onChange(cb)    : registers a listener; returns an unsubscribe fn
     }

   Storage key: 'coach-tools.lineup.<discipline>'
   Stored as a JSON array of strings.
   ============================================================================ */

(function () {
  'use strict';

  var KEY_PREFIX = 'coach-tools.lineup.';
  var listenersByDiscipline = {};

  function keyFor(discipline) {
    return KEY_PREFIX + discipline;
  }

  function read(discipline) {
    try {
      var raw = localStorage.getItem(keyFor(discipline));
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(function (x) { return typeof x === 'string'; }) : [];
    } catch (e) {
      return [];
    }
  }

  function write(discipline, arr) {
    try {
      localStorage.setItem(keyFor(discipline), JSON.stringify(arr));
    } catch (e) {
      // quota / private mode — silent fail; in-memory state is what callers will see
    }
    notify(discipline);
  }

  function notify(discipline) {
    var listeners = listenersByDiscipline[discipline] || [];
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (e) { console.error('Lineup onChange listener failed:', e); }
    }
  }

  // Cross-tab sync: storage events fire in *other* tabs when one tab writes.
  window.addEventListener('storage', function (e) {
    if (!e.key || e.key.indexOf(KEY_PREFIX) !== 0) return;
    var discipline = e.key.slice(KEY_PREFIX.length);
    notify(discipline);
  });

  function forDiscipline(discipline) {
    if (!discipline || typeof discipline !== 'string') {
      throw new Error('Lineup.forDiscipline: discipline must be a non-empty string');
    }

    return {
      getAll: function () {
        return read(discipline);
      },
      has: function (id) {
        return read(discipline).indexOf(id) !== -1;
      },
      add: function (id) {
        var arr = read(discipline);
        if (arr.indexOf(id) === -1) {
          arr.push(id);
          write(discipline, arr);
        }
      },
      remove: function (id) {
        var arr = read(discipline);
        var next = arr.filter(function (x) { return x !== id; });
        if (next.length !== arr.length) {
          write(discipline, next);
        }
      },
      toggle: function (id) {
        var arr = read(discipline);
        var idx = arr.indexOf(id);
        if (idx === -1) {
          arr.push(id);
        } else {
          arr.splice(idx, 1);
        }
        write(discipline, arr);
      },
      clear: function () {
        write(discipline, []);
      },
      count: function () {
        return read(discipline).length;
      },
      onChange: function (cb) {
        if (typeof cb !== 'function') return function () {};
        if (!listenersByDiscipline[discipline]) listenersByDiscipline[discipline] = [];
        listenersByDiscipline[discipline].push(cb);
        return function unsubscribe() {
          var list = listenersByDiscipline[discipline] || [];
          listenersByDiscipline[discipline] = list.filter(function (x) { return x !== cb; });
        };
      }
    };
  }

  window.Lineup = { forDiscipline: forDiscipline };
})();
