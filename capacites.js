// Capacités de classe automatisées (D&D 5e 2014), partagées entre l'appli joueur et la table.
// CFEAT(o) -> {acts:[actions], res:{clé:[max, utilisé, nom, repos]}, cfp:{capacités passives}}
// o = {cls, sub, L, mod:{FOR,DEX,CON,INT,SAG,CHA}, prof, dc}
window.CFEAT = function (o) {
  const L = +o.L || 1, M = o.mod || {}, prof = +o.prof || 2, sub = String(o.sub || ''), acts = [], res = {}, cfp = {};
  const R = (k, n, max, rest) => { res[k] = [Math.max(0, max), 0, n, rest]; };
  const base = { kind: 'auto', cost: 'action', range: 0, area: 0, bonus: 0, dc: +o.dc || 0, save: 'DEX', dmg: '0', dtype: '', half: true, slot: 0, cf: 1 };
  const add = a => acts.push(Object.assign({}, base, a));
  const m = k => +M[k] || 0;
  switch (o.cls) {
    case 'barbare': {
      const n = L < 3 ? 2 : L < 6 ? 3 : L < 12 ? 4 : L < 17 ? 5 : L < 20 ? 6 : 99, b = L < 9 ? 2 : L < 16 ? 3 : 4, bear = L >= 3 && /ours/i.test(sub);
      R('rage', 'Rage', n, 'long');
      add({ name: 'Rage', cost: 'bonus', rk: 'rage', cfv: b, bear: bear ? 1 : 0, note: `1 minute : +${b} aux dégâts au corps à corps, résistance aux dégâts ${bear ? 'de tous types sauf psychiques (totem de l’ours)' : 'contondants, perforants et tranchants'}, avantage aux jets de Force. Pas de sorts ni de concentration.` });
      if (L >= 2) add({ name: 'Attaque téméraire', nf: 1, note: 'Sans coût : avantage à tes attaques d’arme ce tour, mais les attaques contre toi ont l’avantage jusqu’à ton prochain tour.' });
      break;
    }
    case 'barde': {
      const die = '1d' + (L < 5 ? 6 : L < 10 ? 8 : L < 15 ? 10 : 12);
      R('insp', 'Inspiration bardique', Math.max(1, m('CHA')), L >= 5 ? 'court' : 'long');
      add({ name: 'Inspiration bardique', cost: 'bonus', range: 18, rk: 'insp', cfv: die, note: `Un allié (pas toi) gagne ${die} : il s’ajoute tout seul à son prochain jet d’attaque ou de sauvegarde (10 minutes).` });
      if (L >= 3 && /savoir/i.test(sub)) cfp.cw = die;
      break;
    }
    case 'clerc': {
      if (L >= 2) {
        R('cd', 'Conduit divin', L < 6 ? 1 : L < 18 ? 2 : 3, 'court');
        const cr = L >= 17 ? 4 : L >= 14 ? 3 : L >= 11 ? 2 : L >= 8 ? 1 : L >= 5 ? 0.5 : 0;
        add({ name: 'Renvoi des morts-vivants', rk: 'cd', range: 9, cfv: cr, note: `Conduit divin : chaque mort-vivant à 9 m fait un JdS de Sagesse (DD ${o.dc || '?'}) ou fuit pendant 1 minute.${cr ? ` Ceux de FP ${cr === 0.5 ? '1/2' : cr} ou moins sont détruits.` : ''}` });
      }
      if (/temp[eê]te/i.test(sub)) {
        R('ouragan', 'Fureur de l’ouragan', Math.max(1, m('SAG')), 'long');
        cfp.ouragan = { dc: +o.dc || 10 };
        if (L >= 2) add({ name: 'Fureur destructrice', nf: 1, rk: 'cd', note: 'Conduit divin, sans coût d’action : tes prochains dégâts de foudre ou de tonnerre sont au maximum.' });
        if (L >= 8) cfp.fd = { d: L >= 14 ? '2d8' : '1d8', t: 'tonnerre' };
      }
      break;
    }
    case 'guerrier': {
      R('ss', 'Second souffle', 1, 'court');
      add({ name: 'Second souffle', kind: 'soin', cost: 'bonus', dmg: `1d10+${L}`, rk: 'ss', note: 'Récupère 1d10 + niveau PV. Une fois par repos court.' });
      if (L >= 2) { R('fa', 'Fougue', L >= 17 ? 2 : 1, 'court'); add({ name: 'Fougue', nf: 1, rk: 'fa', note: 'Sans coût : une action de plus ce tour.' }); }
      if (L >= 3 && /champion/i.test(sub)) cfp.crit = L >= 15 ? 18 : 19;
      break;
    }
    case 'moine': {
      if (L >= 2) {
        R('ki', 'Points de ki', L, 'court');
        add({ name: 'Défense patiente (1 ki)', cost: 'bonus', rk: 'ki', note: 'Esquiver en action bonus (les attaques contre toi ont le désavantage).' });
        add({ name: 'Pas du vent (1 ki)', cost: 'bonus', rk: 'ki', note: 'Foncer ou Se désengager en action bonus.' });
      }
      if (L >= 5) cfp.stun = { dc: 8 + prof + m('SAG') };
      break;
    }
    case 'paladin': {
      R('imp', 'Imposition des mains', 5 * L, 'long');
      add({ name: 'Imposition des mains', range: 1.5, rk: 'imp', rkNo: 1, note: `Réserve de ${5 * L} PV : soigne une créature au contact du nombre de PV choisi.` });
      if (L >= 2) cfp.smite = 1;
      break;
    }
    case 'roublard': {
      cfp.sa = Math.ceil(L / 2) + 'd6';
      if (L >= 2) {
        add({ name: 'Ruse : Foncer', cost: 'bonus', note: 'Déplacement doublé ce tour.' });
        add({ name: 'Ruse : Se désengager', cost: 'bonus', note: 'Pas d’attaque d’opportunité ce tour.' });
        add({ name: 'Ruse : Se cacher', cost: 'bonus', note: 'Tu te caches (le MJ peut demander un test de Discrétion).' });
      }
      break;
    }
  }
  return { acts, res, cfp };
};
