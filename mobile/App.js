// Trip Expenses Guide — React Native (Expo) port
// Syncs with the web app (same trip codes, same network).
import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Share, StatusBar, Linking, ActivityIndicator, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Gun from 'gun/gun';

/* ================= constants (identical to web) ================= */
const WEB_URL = 'https://prakashanalysto-commits.github.io/sunny-splits/';
const COUNTRIES = [
  ['India','INR','₹'],['United States','USD','$'],['United Kingdom','GBP','£'],
  ['Eurozone (France, Germany, Italy, Spain…)','EUR','€'],['Japan','JPY','¥'],
  ['Thailand','THB','฿'],['Indonesia (Bali)','IDR','Rp'],['Singapore','SGD','S$'],
  ['Malaysia','MYR','RM'],['Vietnam','VND','₫'],['Sri Lanka','LKR','Rs'],
  ['Nepal','NPR','रू'],['UAE (Dubai)','AED','د.إ'],['Saudi Arabia','SAR','﷼'],
  ['Qatar','QAR','﷼'],['Australia','AUD','A$'],['New Zealand','NZD','NZ$'],
  ['Canada','CAD','C$'],['Switzerland','CHF','CHF'],['China','CNY','¥'],
  ['Hong Kong','HKD','HK$'],['South Korea','KRW','₩'],['Turkey','TRY','₺'],
  ['Egypt','EGP','E£'],['South Africa','ZAR','R'],['Brazil','BRL','R$'],
  ['Mexico','MXN','Mex$'],['Russia','RUB','₽'],['Maldives','MVR','Rf'],
  ['Mauritius','MUR','₨'],['Philippines','PHP','₱'],['Cambodia','KHR','៛'],
  ['Bhutan','BTN','Nu.'],['Bangladesh','BDT','৳'],['Pakistan','PKR','₨'],
  ['Kenya','KES','KSh'],['Morocco','MAD','DH'],['Israel','ILS','₪'],
  ['Norway','NOK','kr'],['Sweden','SEK','kr'],['Denmark','DKK','kr'],
  ['Other','USD','$'],
];
const CATS = [['Food','🍜'],['Stay','🏨'],['Travel','🚕'],['Shopping','🛍️'],['Fun','🎉'],['Other','✨']];
const AVATAR_COLORS = ['#FF7B54','#FFB84C','#7ED8B2','#8EC9E8','#C39BD3','#F1948A','#76D7C4','#F7B7A3'];
const BAR_COLORS = ['#FF7B54','#FFB84C','#7ED8B2','#8EC9E8','#C39BD3','#F1948A'];
const RELAYS = [
  'https://relay.peer.ooo/gun',
  'https://gun-manhattan.herokuapp.com/gun',
  'https://peer.wallie.io/gun',
  'https://gun-us.herokuapp.com/gun',
];
const NS = 'sunnysplits26_';
const MYKEY = 'ss26_my';

const TIPS = {
  'India': ['Use local trains/metro & UPI-friendly autos over cabs; agree fares first.','Eat where the queue of locals is: thali joints & dhabas beat tourist cafés.','Book trains on IRCTC early; sleeper class saves a hotel night.'],
  'Thailand': ['Songthaews & BTS beat taxis; agree tuk-tuk fares before boarding.','Street food courts (30-60฿ meals) are the best food in the country.','7-Eleven water & SIMs; book islands ferries as combos.'],
  'Indonesia (Bali)': ['Rent a scooter (~Rp 70k/day) instead of private drivers.','Warungs over beach clubs: nasi campur ~Rp 25k.','Bargain hard in markets; start at 40% of quoted price.'],
  'UAE (Dubai)': ['Metro + Nol card beats taxis; happy-hour brunches over dinner.','Old Dubai (Deira/Al Fahidi) food is half the price of Marina.','Free: beaches, Dubai Fountain, souks, Creek abra ride (1 AED).'],
  'Japan': ['Get a rail pass BEFORE arrival; konbini meals are great & cheap.','Lunch teishoku sets cost half of the same food at dinner.','Free temples, gardens & observation decks (Tokyo Met Gov Bldg).'],
  'Vietnam': ['Grab bikes are dirt cheap; overnight buses save hotel nights.','Bánh mì & phở street stalls: full meals under 50k₫.','Haggle in markets, fixed price in supermarkets — buy snacks there.'],
  'Sri Lanka': ['Trains are scenic AND the cheapest transport — book 2nd class.','Rice & curry lunch buffets are the best value meal.','Negotiate tuk-tuks or use the PickMe app.'],
  'Nepal': ['Local buses & shared jeeps over private transport.','Dal bhat power: refills are free in most local spots.','Teahouse treks: carry snacks, prices rise with altitude.'],
  'Maldives': ['Stay on local islands (Maafushi) — guesthouses cost 10% of resorts.','Public ferries between islands are $2-5 vs $50+ speedboats.','Bring your own snorkel gear.'],
  'Singapore': ['Hawker centres: world-class food for S$4-6.','EZ-Link + MRT everywhere; avoid taxis.','Free: Gardens by the Bay outdoor, Marina Bay light show, parks.'],
};
const TIPS_DEFAULT = ['Cook or picnic 1 meal a day; markets over restaurants.','Use public transport day passes instead of ride-hailing.','Book stays with kitchens & free cancellation; travel off-peak.'];

/* ================= gun ================= */
const gun = Gun({ peers: RELAYS, localStorage: false, radisk: false, axe: false });

/* ================= helpers ================= */
function fmt(n, sym) {
  n = +n || 0;
  const digits = Math.abs(n) >= 1000 ? 0 : 2;
  let s;
  try { s = n.toLocaleString('en-IN', { maximumFractionDigits: digits }); }
  catch (e) { s = n.toFixed(digits); }
  return sym + s;
}
const initials = (n) => (n || '?').trim().slice(0, 2).toUpperCase();
const avatarColor = (i) => AVATAR_COLORS[i % AVATAR_COLORS.length];
const catEmoji = (c) => { const f = CATS.find((x) => x[0] === c); return f ? f[1] : '✨'; };
function genCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}
const slug = (n) => (n.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24)) || ('m' + Date.now());
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
function dayCount(meta) {
  const end = meta.endedAt || Date.now();
  return Math.max(1, Math.ceil((end - meta.createdAt) / 86400000));
}
function calc(members, expenses) {
  const total = expenses.reduce((s, e) => s + e.amt, 0);
  const paid = {};
  Object.values(members).forEach((m) => { paid[m.name] = 0; });
  expenses.forEach((e) => { paid[e.payer] = (paid[e.payer] || 0) + e.amt; });
  const allNames = Object.keys(paid);
  const share = allNames.length ? total / allNames.length : 0;
  const balances = allNames.map((n) => ({ name: n, paid: paid[n], bal: paid[n] - share }));
  const debtors = balances.filter((b) => b.bal < -0.01).map((b) => ({ n: b.name, v: -b.bal })).sort((a, b) => b.v - a.v);
  const creditors = balances.filter((b) => b.bal > 0.01).map((b) => ({ n: b.name, v: b.bal })).sort((a, b) => b.v - a.v);
  const settlements = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].v, creditors[j].v);
    settlements.push({ from: debtors[i].n, to: creditors[j].n, amt: pay });
    debtors[i].v -= pay; creditors[j].v -= pay;
    if (debtors[i].v < 0.01) i++;
    if (creditors[j].v < 0.01) j++;
  }
  const cats = {};
  expenses.forEach((e) => { cats[e.cat] = (cats[e.cat] || 0) + e.amt; });
  const catArr = Object.entries(cats).map(([c, v]) => ({ cat: c, v, pc: total ? (v / total) * 100 : 0 })).sort((a, b) => b.v - a.v);
  return { total, share, balances, settlements, catArr, count: allNames.length };
}

/* ================= App ================= */
export default function App() {
  const [my, setMy] = useState({ trips: {} });
  const [tab, setTab] = useState('current');            // current | past
  const [screen, setScreen] = useState('home');         // home | trip
  const [, setTick] = useState(0);
  const [online, setOnline] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);

  // forms
  const [tripName, setTripName] = useState('');
  const [countryIdx, setCountryIdx] = useState(0);
  const [showCountries, setShowCountries] = useState(false);
  const [creatorName, setCreatorName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [cat, setCat] = useState('Food');
  const [payer, setPayer] = useState('');
  const [briefs, setBriefs] = useState({});

  const tRef = useRef(null);
  const refsRef = useRef([]);
  const bumpT = useRef(null);
  const bump = () => {
    clearTimeout(bumpT.current);
    bumpT.current = setTimeout(() => setTick((x) => x + 1), 160);
  };

  useEffect(() => {
    AsyncStorage.getItem(MYKEY).then((v) => { if (v) try { setMy(JSON.parse(v)); } catch (e) {} });
    gun.on('hi', () => setOnline(true));
    gun.on('bye', () => setOnline(false));
  }, []);
  const saveMy = (d) => { setMy(d); AsyncStorage.setItem(MYKEY, JSON.stringify(d)); };

  /* ---------- trip lifecycle ---------- */
  function detach() {
    refsRef.current.forEach((r) => { try { r.off(); } catch (e) {} });
    refsRef.current = [];
  }
  function openTrip(code, myObj) {
    detach();
    code = code.toUpperCase();
    tRef.current = { code, meta: null, members: {}, exp: {} };
    const root = gun.get(NS + code);
    const mRef = root.get('meta');
    const memRef = root.get('members').map();
    const eRef = root.get('exp').map();
    refsRef.current = [mRef, root.get('members'), root.get('exp')];
    mRef.on((m) => {
      const t = tRef.current;
      if (!m || !t || t.code !== code) return;
      t.meta = Object.assign({}, t.meta, m); delete t.meta._;
      bump();
    });
    memRef.on((m, k) => {
      const t = tRef.current;
      if (!t || t.code !== code) return;
      if (m && m.name) { t.members[k] = Object.assign({}, m); delete t.members[k]._; }
      bump();
    });
    eRef.on((e, k) => {
      const t = tRef.current;
      if (!t || t.code !== code) return;
      if (e) { t.exp[k] = Object.assign({}, t.exp[k], e); delete t.exp[k]._; }
      bump();
    });
    // re-seed relays from my local copy (heals restarted free relays)
    const mine = (myObj || my).trips[code];
    setTimeout(() => {
      const t = tRef.current;
      if (!t || t.code !== code || !t.meta || !mine) return;
      root.get('meta').put(Object.assign({}, t.meta));
      Object.entries(t.members).forEach(([k, v]) => root.get('members').get(k).put(Object.assign({}, v)));
      Object.entries(t.exp).forEach(([k, v]) => root.get('exp').get(k).put(Object.assign({}, v)));
    }, 4000);
    setScreen('trip');
  }
  function closeTrip() { detach(); tRef.current = null; setScreen('home'); }

  function createTrip() {
    const name = tripName.trim(), me = creatorName.trim();
    if (!name) return Alert.alert('', 'Give your trip a name 🌍');
    if (!me) return Alert.alert('', 'Add your name 🙋');
    const c = COUNTRIES[countryIdx];
    const code = genCode();
    const root = gun.get(NS + code);
    root.get('meta').put({ name, country: c[0], ccode: c[1], sym: c[2], code, createdAt: Date.now(), endedAt: 0, createdBy: me });
    root.get('members').get(slug(me)).put({ name: me, at: Date.now() });
    const d = { ...my, trips: { ...my.trips, [code]: { myName: me, joined: Date.now() } } };
    saveMy(d);
    setTripName(''); setCreatorName(''); setPayer(me);
    openTrip(code, d);
  }

  function joinTrip() {
    const code = joinCode.trim().toUpperCase(), me = joinName.trim();
    if (code.length !== 6) return Alert.alert('', 'Enter the 6-character trip code');
    if (!me) return Alert.alert('', 'Add your name 🙋');
    setJoinBusy(true);
    let done = false;
    const root = gun.get(NS + code);
    const metaRef = root.get('meta');
    const finish = (found) => {
      if (done) return;
      done = true;
      try { metaRef.off(); } catch (e) {}
      setJoinBusy(false);
      if (!found) return Alert.alert('Trip not found', 'Ask the creator to open the trip on their phone, then try again 🌫️');
      root.get('members').get(slug(me)).put({ name: me, at: Date.now() });
      const d = { ...my, trips: { ...my.trips, [code]: { myName: me, joined: Date.now() } } };
      saveMy(d);
      setJoinCode(''); setJoinName(''); setPayer(me);
      openTrip(code, d);
    };
    metaRef.on((m) => { if (m && m.name) finish(true); });
    setTimeout(() => finish(false), 25000);
  }

  /* ---------- expenses ---------- */
  const liveExpenses = (t) => Object.entries(t.exp)
    .filter(([, e]) => e && !e.del && e.amt > 0)
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => b.at - a.at);

  function addExpense() {
    const t = tRef.current;
    if (!t || !t.meta) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return Alert.alert('', 'Enter an amount 💰');
    const who = payer || (my.trips[t.code] || {}).myName || '';
    gun.get(NS + t.code).get('exp').get(newId()).put({
      amt: Math.round(amt * 100) / 100,
      note: note.trim() || cat,
      cat, payer: who,
      by: (my.trips[t.code] || {}).myName || who,
      at: Date.now(), del: 0,
    });
    setAmount(''); setNote('');
  }
  const delExpense = (id) => {
    const t = tRef.current;
    if (!t) return;
    Alert.alert('Delete expense?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => gun.get(NS + t.code).get('exp').get(id).put({ del: 1 }) },
    ]);
  };
  function addMemberManual() {
    const t = tRef.current;
    if (!t) return;
    if (Platform.OS === 'ios') {
      Alert.prompt('Add traveller', 'Name of someone not using the app:', (name) => {
        if (name && name.trim()) gun.get(NS + t.code).get('members').get(slug(name)).put({ name: name.trim(), at: Date.now(), manual: 1 });
      });
    } else Alert.alert('', 'On Android, ask them to join with the code instead.');
  }
  function endTrip() {
    const t = tRef.current;
    if (!t || !t.meta) return;
    if (liveExpenses(t).length === 0) return Alert.alert('', 'No expenses yet, add some first!');
    Alert.alert('End trip?', `End "${t.meta.name}" for the whole group and calculate everyone's share?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End trip 🏁', style: 'destructive', onPress: () => gun.get(NS + t.code).get('meta').put({ endedAt: Date.now() }) },
    ]);
  }
  function shareInvite() {
    const t = tRef.current;
    if (!t || !t.meta) return;
    Share.share({ message: `Join my trip "${t.meta.name}" on Trip Expenses Guide ✈️\nCode: ${t.code}\n${WEB_URL}?join=${t.code}` });
  }

  /* ---------- past/active briefs ---------- */
  function loadBriefs() {
    Object.keys(my.trips).forEach((code) => {
      const root = gun.get(NS + code);
      root.get('meta').once((m) => {
        if (m && m.name) setBriefs((b) => ({ ...b, [code]: { ...(b[code] || { total: 0, _e: {} }), meta: m } }));
      });
      root.get('exp').map().once((e, k) => {
        if (e && !e.del && e.amt > 0) setBriefs((b) => {
          const cur = b[code] || { total: 0, _e: {} };
          const _e = { ...cur._e, [k]: e.amt };
          return { ...b, [code]: { ...cur, _e, total: Object.values(_e).reduce((s, v) => s + v, 0) } };
        });
      });
    });
  }
  useEffect(() => { loadBriefs(); }, [my, screen, tab]);

  /* ================= UI pieces ================= */
  const t = tRef.current;
  const myName = t ? (my.trips[t.code] || {}).myName : '';

  const Card = ({ children, style }) => <View style={[st.card, style]}>{children}</View>;
  const H2 = ({ children, small }) => (
    <Text style={st.h2}>{children}{small ? <Text style={st.h2small}>  {small}</Text> : null}</Text>
  );
  const Btn = ({ label, onPress, kind = 'sun', busy }) => (
    <TouchableOpacity style={[st.btn, kind === 'sun' ? st.btnSun : kind === 'danger' ? st.btnDanger : st.btnGhost]} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={[st.btnTxt, kind === 'sun' ? { color: '#fff' } : kind === 'danger' ? { color: '#FF8A8A' } : { color: '#F5EDE2' }]}>{label}</Text>}
    </TouchableOpacity>
  );
  const Input = (props) => <TextInput placeholderTextColor="#6B5B49" style={st.input} {...props} />;

  function Bars({ catArr, sym }) {
    return catArr.map((c, i) => (
      <View key={c.cat} style={{ marginBottom: 12 }}>
        <View style={st.rowBetween}>
          <Text style={st.barLabel}>{catEmoji(c.cat)} {c.cat}</Text>
          <Text style={st.barLabel}>{fmt(c.v, sym)} <Text style={{ color: '#A79683' }}>{c.pc.toFixed(0)}%</Text></Text>
        </View>
        <View style={st.barTrack}><View style={[st.barFill, { width: `${c.pc}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }]} /></View>
      </View>
    ));
  }

  function Summary({ meta, members, expenses }) {
    const { total, share, balances, settlements, catArr, count } = calc(members, expenses);
    const days = dayCount(meta);
    const biggest = expenses.slice().sort((a, b) => b.amt - a.amt)[0];
    const topPayer = balances.slice().sort((a, b) => b.paid - a.paid)[0];
    const tips = TIPS[meta.country] || TIPS_DEFAULT;
    return (
      <View>
        <Card style={st.hero}>
          <Text style={st.heroPlace}>{meta.name} · {meta.country} · WRAPPED 🎉</Text>
          <Text style={st.heroAmount}>{fmt(total, meta.sym)}</Text>
          <Text style={st.heroSub}>{count} travellers · {days} day{days > 1 ? 's' : ''} · {expenses.length} expenses</Text>
        </Card>

        <Card>
          <H2 small={`${fmt(share, meta.sym)} each`}>👥 Everyone's share</H2>
          {balances.map((b, i) => (
            <View key={b.name} style={st.person}>
              <View style={[st.avatar, { backgroundColor: avatarColor(i) }]}><Text style={st.avatarTxt}>{initials(b.name)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={st.pName}>{b.name}</Text>
                <Text style={st.pSub}>paid {fmt(b.paid, meta.sym)} · share {fmt(share, meta.sym)}</Text>
              </View>
              {b.bal > 0.01 ? <Text style={[st.badge, st.badgeGet]}>gets {fmt(b.bal, meta.sym)}</Text>
                : b.bal < -0.01 ? <Text style={[st.badge, st.badgeOwe]}>owes {fmt(-b.bal, meta.sym)}</Text>
                : <Text style={[st.badge, st.badgeEven]}>all square ✌️</Text>}
            </View>
          ))}
        </Card>

        <Card>
          <H2 small="fewest transfers">🤝 Settle up</H2>
          {settlements.length === 0 ? <Text style={st.body}>🎊 Perfectly balanced, nothing to settle!</Text>
            : settlements.map((s, i) => (
              <View key={i} style={st.settle}>
                <Text style={st.body}><Text style={st.bold}>{s.from}</Text> <Text style={{ color: '#FF7B54' }}>→</Text> <Text style={st.bold}>{s.to}</Text>   {fmt(s.amt, meta.sym)}</Text>
              </View>
            ))}
        </Card>

        <Card>
          <H2>📊 Where the money went</H2>
          <Bars catArr={catArr} sym={meta.sym} />
        </Card>

        <Card>
          <H2>💡 Trip insights</H2>
          {catArr[0] && <Text style={st.insight}>✦ {catEmoji(catArr[0].cat)} {catArr[0].cat} was the biggest spend: {fmt(catArr[0].v, meta.sym)} ({catArr[0].pc.toFixed(0)}% of the trip).</Text>}
          {biggest && <Text style={st.insight}>✦ 💸 Biggest single expense: {biggest.note} at {fmt(biggest.amt, meta.sym)}, paid by {biggest.payer}.</Text>}
          <Text style={st.insight}>✦ 📅 The group averaged {fmt(total / days, meta.sym)}/day ({fmt(count ? total / days / count : 0, meta.sym)} per person per day).</Text>
          {topPayer && topPayer.paid > 0 && total > 0 && <Text style={st.insight}>✦ 🏆 {topPayer.name} was the MVP wallet, paying {(topPayer.paid / total * 100).toFixed(0)}% of everything.</Text>}
        </Card>

        <Card>
          <H2 small={`for ${meta.country}`}>🪙 Spend less next time</H2>
          {tips.map((tip, i) => <Text key={i} style={st.insight}>{i + 1}. {tip}</Text>)}
          <Btn label="✨ Full AI coach (opens web app)" onPress={() => Linking.openURL(WEB_URL + '?join=' + meta.code)} />
        </Card>

        <Card>
          <H2>🧾 All expenses</H2>
          {expenses.map((e) => (
            <View key={e.id} style={st.exp}>
              <Text style={st.expEmoji}>{catEmoji(e.cat)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.pName} numberOfLines={1}>{e.note}</Text>
                <Text style={st.pSub}>{e.payer}</Text>
              </View>
              <Text style={st.expAmt}>{fmt(e.amt, meta.sym)}</Text>
            </View>
          ))}
        </Card>
      </View>
    );
  }

  /* ================= screens ================= */
  let content;
  if (screen === 'trip' && t) {
    const expenses = liveExpenses(t);
    if (!t.meta) {
      content = (
        <View style={st.empty}><Text style={st.emptyEmoji}>🛰️</Text><Text style={st.emptyTxt}>Syncing trip {t.code}…</Text></View>
      );
    } else if (t.meta.endedAt) {
      content = <Summary meta={t.meta} members={t.members} expenses={expenses} />;
    } else {
      const m = t.meta;
      const memArr = Object.values(t.members).sort((a, b) => a.at - b.at);
      const { balances, total } = calc(t.members, expenses);
      const paidBy = {}; balances.forEach((b) => { paidBy[b.name] = b.paid; });
      content = (
        <View>
          <Card style={st.hero}>
            <Text style={st.heroPlace}>{m.name} · {m.country}</Text>
            <Text style={st.heroAmount}>{fmt(total, m.sym)}</Text>
            <Text style={st.heroSub}>{memArr.length} travellers · {fmt(memArr.length ? total / memArr.length : 0, m.sym)} per head so far</Text>
            <TouchableOpacity style={st.codeChip} onPress={shareInvite}>
              <Text style={st.codeTxt}>{t.code}</Text><Text style={st.codeSub}>  tap to share invite</Text>
            </TouchableOpacity>
          </Card>

          <Card>
            <View style={st.rowBetween}>
              <H2 small="live for everyone">👥 The group</H2>
              <TouchableOpacity onPress={addMemberManual}><Text style={st.link}>+ person</Text></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {memArr.map((mm, i) => (
                <View key={mm.name} style={st.mBadge}>
                  <View style={[st.avatar, { width: 44, height: 44, borderRadius: 22, backgroundColor: avatarColor(i) }, mm.name === myName && st.meRing]}>
                    <Text style={st.avatarTxt}>{initials(mm.name)}</Text>
                  </View>
                  <Text style={st.mName} numberOfLines={1}>{mm.name}{mm.name === myName ? ' (you)' : ''}</Text>
                  <Text style={st.mPaid}>{fmt(paidBy[mm.name] || 0, m.sym)}</Text>
                </View>
              ))}
            </ScrollView>
          </Card>

          <Card>
            <H2 small="every chai counts!">✍️ Add expense</H2>
            <View style={st.row}>
              <View style={{ flex: 1 }}>
                <Text style={st.label}>AMOUNT ({m.sym})</Text>
                <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />
              </View>
            </View>
            <Text style={st.label}>PAID BY</Text>
            <View style={st.chipsWrap}>
              {memArr.map((mm) => (
                <TouchableOpacity key={mm.name} style={[st.chip, (payer || myName) === mm.name && st.chipSel]} onPress={() => setPayer(mm.name)}>
                  <Text style={[st.chipTxt, (payer || myName) === mm.name && { color: '#FFB84C' }]}>{mm.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={st.label}>WHAT WAS IT?</Text>
            <Input value={note} onChangeText={setNote} placeholder="Beach shack lunch" maxLength={50} />
            <Text style={st.label}>CATEGORY</Text>
            <View style={st.chipsWrap}>
              {CATS.map(([c, em]) => (
                <TouchableOpacity key={c} style={[st.chip, cat === c && st.chipSel]} onPress={() => setCat(c)}>
                  <Text style={[st.chipTxt, cat === c && { color: '#FFB84C' }]}>{em} {c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Btn label="Add it ➕" onPress={addExpense} />
          </Card>

          <Card>
            <H2 small={`${expenses.length} so far`}>🧾 Expenses</H2>
            {expenses.length === 0
              ? <Text style={st.body}>🌤️ Nothing yet. Add your first expense above!</Text>
              : expenses.map((e) => (
                <TouchableOpacity key={e.id} style={st.exp} onLongPress={() => delExpense(e.id)}>
                  <Text style={st.expEmoji}>{catEmoji(e.cat)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={st.pName} numberOfLines={1}>{e.note}</Text>
                    <Text style={st.pSub}>{e.payer} · long-press to delete</Text>
                  </View>
                  <Text style={st.expAmt}>{fmt(e.amt, m.sym)}</Text>
                </TouchableOpacity>
              ))}
          </Card>

          <Btn label="🏁 End trip & see the split" kind="danger" onPress={endTrip} />
        </View>
      );
    }
  } else {
    // home / past
    const codes = Object.keys(my.trips);
    const active = codes.filter((c) => briefs[c] && briefs[c].meta && !briefs[c].meta.endedAt);
    const ended = codes.filter((c) => briefs[c] && briefs[c].meta && briefs[c].meta.endedAt)
      .sort((a, b) => briefs[b].meta.endedAt - briefs[a].meta.endedAt);
    content = tab === 'past' ? (
      <View>
        {ended.length === 0
          ? <View style={st.empty}><Text style={st.emptyEmoji}>🗺️</Text><Text style={st.emptyTxt}>No finished trips yet.{'\n'}End a trip and it appears here for the whole group.</Text></View>
          : ended.map((c) => (
            <TouchableOpacity key={c} onPress={() => openTrip(c)}>
              <Card>
                <View style={st.rowBetween}>
                  <Text style={st.pName}>{briefs[c].meta.name}</Text>
                  <Text style={[st.pName, { color: '#FF7B54' }]}>{fmt(briefs[c].total, briefs[c].meta.sym)}</Text>
                </View>
                <Text style={st.pSub}>{briefs[c].meta.country} · tap for full breakdown</Text>
              </Card>
            </TouchableOpacity>
          ))}
      </View>
    ) : (
      <View>
        {active.length > 0 && <Text style={st.sectionLabel}>⛱️ YOUR ACTIVE TRIPS</Text>}
        {active.map((c) => (
          <TouchableOpacity key={c} onPress={() => openTrip(c)}>
            <Card>
              <View style={st.rowBetween}>
                <Text style={st.pName}>{briefs[c].meta.name}</Text>
                <Text style={[st.pName, { color: '#FF7B54' }]}>{fmt(briefs[c].total, briefs[c].meta.sym)}</Text>
              </View>
              <Text style={st.pSub}>{briefs[c].meta.country} · code {c} · you: {(my.trips[c] || {}).myName}</Text>
            </Card>
          </TouchableOpacity>
        ))}

        <Card>
          <H2>🌴 Start a new trip</H2>
          <Text style={st.label}>TRIP NAME</Text>
          <Input value={tripName} onChangeText={setTripName} placeholder="Goa Getaway" maxLength={40} />
          <Text style={st.label}>COUNTRY</Text>
          <TouchableOpacity style={st.input} onPress={() => setShowCountries(!showCountries)}>
            <Text style={{ color: '#F5EDE2', fontSize: 15 }}>{COUNTRIES[countryIdx][0]} ({COUNTRIES[countryIdx][2]} {COUNTRIES[countryIdx][1]})  ▾</Text>
          </TouchableOpacity>
          {showCountries && (
            <View style={st.dropdown}>
              <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
                {COUNTRIES.map((c, i) => (
                  <TouchableOpacity key={c[0]} style={st.dropItem} onPress={() => { setCountryIdx(i); setShowCountries(false); }}>
                    <Text style={{ color: i === countryIdx ? '#FFB84C' : '#F5EDE2', fontSize: 15 }}>{c[0]} ({c[2]} {c[1]})</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <Text style={st.label}>YOUR NAME</Text>
          <Input value={creatorName} onChangeText={setCreatorName} placeholder="e.g. Prakash" maxLength={20} />
          <Btn label="Create trip & get share code 🚀" onPress={createTrip} />
        </Card>

        <Text style={st.sectionLabel}>OR</Text>

        <Card>
          <H2>🎟️ Join a friend's trip</H2>
          <Text style={st.label}>TRIP CODE</Text>
          <Input value={joinCode} onChangeText={(v) => setJoinCode(v.toUpperCase())} placeholder="K7PMQ2" maxLength={6} autoCapitalize="characters" />
          <Text style={st.label}>YOUR NAME</Text>
          <Input value={joinName} onChangeText={setJoinName} placeholder="e.g. Priya" maxLength={20} />
          <Btn label={joinBusy ? '' : 'Join trip 🤝'} kind="ghost" onPress={joinTrip} busy={joinBusy} />
          {joinBusy && <Text style={[st.pSub, { textAlign: 'center', marginTop: 8 }]}>Finding trip… can take up to 25s</Text>}
        </Card>
      </View>
    );
  }

  return (
    <SafeAreaView style={st.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1B1712" />
      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
        <View style={st.header}>
          <Text style={st.h1}>Trip <Text style={{ color: '#FF7B54' }}>Expenses</Text> Guide ✈️</Text>
          <Text style={st.tagline}>happy trips, fair splits, together</Text>
          <View style={st.livePill}>
            <View style={[st.liveDot, online && { backgroundColor: '#5FD69B' }]} />
            <Text style={[st.liveTxt, online && { color: '#5FD69B' }]}>{online ? 'live' : 'offline'}</Text>
          </View>
        </View>

        {screen === 'trip' ? (
          <TouchableOpacity onPress={closeTrip}><Text style={[st.link, { marginBottom: 12 }]}>← My trips</Text></TouchableOpacity>
        ) : (
          <View style={st.tabs}>
            {['current', 'past'].map((tb) => (
              <TouchableOpacity key={tb} style={[st.tabBtn, tab === tb && st.tabActive]} onPress={() => setTab(tb)}>
                <Text style={[st.tabTxt, tab === tb && { color: '#F5EDE2' }]}>{tb === 'current' ? 'My Trips' : 'Past Trips'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {content}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ================= styles (dark warm theme) ================= */
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B1712' },
  scroll: { padding: 16, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' },
  header: { alignItems: 'center', paddingVertical: 14 },
  h1: { fontSize: 24, fontWeight: '800', color: '#F5EDE2', letterSpacing: -0.5 },
  tagline: { color: '#A79683', fontSize: 13, marginTop: 3 },
  livePill: { position: 'absolute', right: 0, top: 18, flexDirection: 'row', alignItems: 'center' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#5A4E40', marginRight: 5 },
  liveTxt: { fontSize: 11, fontWeight: '800', color: '#A79683' },
  tabs: { flexDirection: 'row', backgroundColor: '#332B22', borderRadius: 16, padding: 5, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabActive: { backgroundColor: '#26211B' },
  tabTxt: { fontWeight: '700', fontSize: 14, color: '#A79683' },
  card: { backgroundColor: '#26211B', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#3B3228' },
  h2: { fontSize: 16, fontWeight: '800', color: '#F5EDE2', marginBottom: 12 },
  h2small: { color: '#A79683', fontWeight: '600', fontSize: 12 },
  label: { fontSize: 11, fontWeight: '700', color: '#A79683', marginTop: 10, marginBottom: 5, letterSpacing: 0.5 },
  input: { backgroundColor: '#221D17', borderWidth: 1.5, borderColor: '#3B3228', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#F5EDE2' },
  row: { flexDirection: 'row', gap: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  btn: { padding: 14, borderRadius: 16, alignItems: 'center', marginTop: 14 },
  btnSun: { backgroundColor: '#FF9550' },
  btnGhost: { backgroundColor: '#332B22' },
  btnDanger: { backgroundColor: '#3A2323' },
  btnTxt: { fontSize: 15, fontWeight: '800' },
  link: { color: '#FF7B54', fontWeight: '800', fontSize: 14 },
  hero: { backgroundColor: '#43301D', alignItems: 'center', borderColor: '#43301D' },
  heroPlace: { fontSize: 12, fontWeight: '700', color: '#FFC98A', letterSpacing: 1, textTransform: 'uppercase' },
  heroAmount: { fontSize: 36, fontWeight: '800', color: '#FFF6EA', marginVertical: 4 },
  heroSub: { fontSize: 13, color: '#E8C9A0', fontWeight: '600' },
  codeChip: { flexDirection: 'row', borderWidth: 1.5, borderColor: '#FF7B54', borderStyle: 'dashed', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, marginTop: 10, alignItems: 'center' },
  codeTxt: { color: '#FF7B54', fontWeight: '800', fontSize: 16, letterSpacing: 3 },
  codeSub: { color: '#FF7B54', fontSize: 11, fontWeight: '700' },
  mBadge: { alignItems: 'center', marginRight: 14, width: 64 },
  meRing: { borderWidth: 3, borderColor: '#FFB84C' },
  mName: { fontSize: 11, fontWeight: '700', color: '#F5EDE2', marginTop: 5 },
  mPaid: { fontSize: 10, color: '#A79683', fontWeight: '700' },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#221D17', borderWidth: 1.5, borderColor: '#3B3228', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
  chipSel: { borderColor: '#FFB84C', backgroundColor: '#332B22' },
  chipTxt: { color: '#F5EDE2', fontSize: 13, fontWeight: '700' },
  exp: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#332B22' },
  expEmoji: { fontSize: 20, width: 38, height: 38, backgroundColor: '#332B22', borderRadius: 12, textAlign: 'center', lineHeight: 36, overflow: 'hidden', marginRight: 12 },
  expAmt: { fontWeight: '800', fontSize: 14, color: '#F5EDE2' },
  person: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#332B22', gap: 12 },
  pName: { fontWeight: '700', fontSize: 14, color: '#F5EDE2' },
  pSub: { fontSize: 12, color: '#A79683' },
  badge: { fontSize: 12, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' },
  badgeGet: { backgroundColor: '#1E3B2D', color: '#7FE0AE' },
  badgeOwe: { backgroundColor: '#442326', color: '#FF8A8A' },
  badgeEven: { backgroundColor: '#332B22', color: '#A79683' },
  settle: { backgroundColor: '#332B22', borderRadius: 14, padding: 12, marginBottom: 8 },
  body: { color: '#F5EDE2', fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: '800', color: '#F5EDE2' },
  insight: { backgroundColor: '#332B22', borderRadius: 14, padding: 12, marginBottom: 8, color: '#F5EDE2', fontSize: 13.5, lineHeight: 20, overflow: 'hidden' },
  barLabel: { fontSize: 13, fontWeight: '700', color: '#F5EDE2' },
  barTrack: { height: 10, backgroundColor: '#332B22', borderRadius: 99, marginTop: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 99 },
  sectionLabel: { textAlign: 'center', color: '#A79683', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginVertical: 8 },
  dropdown: { backgroundColor: '#221D17', borderWidth: 1.5, borderColor: '#3B3228', borderRadius: 14, marginTop: 6 },
  dropItem: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#2A241E' },
  empty: { alignItems: 'center', padding: 40 },
  emptyEmoji: { fontSize: 44, marginBottom: 10 },
  emptyTxt: { color: '#A79683', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
