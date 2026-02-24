function solveAll() {
    solveTemperature();
    solvePressure();
    updateConditionalSections();
    syncPastWeatherSelection();
    enforceCloudFormRules();
    updateTenthsHints();
    solveWindAverages();
    solveVisibility();
    buildSynop();
}

function solveTemperature() {
    const P_ctx = 900;
    const T = parseFloat(document.getElementById('T_db').value);
    const Tw = parseFloat(document.getElementById('T_wb').value);

    if (isNaN(T) || isNaN(Tw)) {
        document.getElementById('res-dp').innerText = '--';
        document.getElementById('res-rh').innerText = '--';
        document.getElementById('res-vp').innerText = '--';
        return;
    }

    const ew = 6.11 * Math.pow(10, (7.5 * Tw) / (237.3 + Tw));
    const e = ew - (0.000799 * P_ctx * (T - Tw));
    const es = 6.11 * Math.pow(10, (7.5 * T) / (237.3 + T));
    const rh = Math.round(Math.max(0, Math.min(100, (e / es) * 100)));
    const dp = (237.3 * Math.log10(e / 6.11)) / (7.5 - Math.log10(e / 6.11));

    document.getElementById('res-dp').innerText = dp.toFixed(1) + ' C';
    document.getElementById('res-rh').innerText = rh + '%';
    document.getElementById('res-vp').innerText = e.toFixed(1) + ' hPa';
}

function solvePressure() {
    const tK = parseFloat(document.getElementById('barT').value);
    const slp = parseFloat(document.getElementById('targetSLP').value);
    const prevSlp = parseFloat(document.getElementById('prevSLP').value);
    const dbTemp = parseFloat(document.getElementById('T_db').value);
    const instC = parseFloat(document.getElementById('instrC').value) || 0;

    document.getElementById('res-table1').innerText = '--';
    document.getElementById('res-table2').innerText = '--';
    document.getElementById('res-instr-reading').innerText = '--';
    document.getElementById('res-mslp').innerText = '--';

    if (isNaN(tK) || isNaN(slp)) {
        document.getElementById('res-p24').innerText = '--';
        return;
    }

    if (!isNaN(prevSlp)) {
        const diff = slp - prevSlp;
        document.getElementById('res-p24').innerText = (diff >= 0 ? '+' : '') + diff.toFixed(1) + ' hPa';
    } else {
        document.getElementById('res-p24').innerText = '--';
    }

    const roundedT = (Math.round(tK * 2) / 2).toFixed(1);
    const colIdxI = slp <= 930 ? 0 : slp <= 950 ? 1 : slp <= 970 ? 2 : slp <= 990 ? 3 : 4;
    const entryI = barTable[roundedT];

    if (entryI) {
        const t1Corr = entryI[colIdxI];
        const sign = parseFloat(roundedT) > 274.0 ? -1 : 1;
        const finalT1 = sign * t1Corr;
        const readingP = slp - instC - finalT1;

        document.getElementById('res-table1').innerText = (sign > 0 ? '+' : '-') + t1Corr.toFixed(1);
        document.getElementById('res-instr-reading').innerText = readingP.toFixed(1) + ' hPa';
    }

    if (!isNaN(dbTemp)) {
        const rowKey = Object.keys(dryBulbTable).find((k) => {
            const match = k.match(/^(-?\d+(?:\.\d+)?)\-(-?\d+(?:\.\d+)?)$/);
            if (!match) {
                return false;
            }
            const min = Number(match[1]);
            const max = Number(match[2]);
            return dbTemp >= min && dbTemp <= max;
        });

        if (rowKey) {
            const colIdxII = Math.round((slp - 930) / 2);
            const entryII = dryBulbTable[rowKey];
            const t2Corr = entryII[colIdxII];

            if (typeof t2Corr === 'number') {
                document.getElementById('res-table2').innerText = '+' + t2Corr.toFixed(1);
                document.getElementById('res-mslp').innerText = (slp + t2Corr).toFixed(1) + ' hPa';
            }
        }
    }
}

function updateConditionalSections() {
    const utc = document.getElementById('utcSlot').value;
    const ww = document.getElementById('weatherWW').value;
    const is03 = utc === '03';
    const is12 = utc === '12';

    document.getElementById('wind-12z-fields').style.display = is12 ? 'block' : 'none';
    document.getElementById('wind-03z-fields').style.display = is03 ? 'block' : 'none';
    document.getElementById('rain-03z-extra').style.display = is03 ? 'block' : 'none';
    document.getElementById('past-weather-fields').style.display = ww === '00' ? 'none' : 'flex';
    document.getElementById('temp-tmax-field').style.display = is03 || is12 ? 'block' : 'none';
    document.getElementById('temp-tmin-field').style.display = is03 ? 'block' : 'none';

    document.getElementById('wind-avg-card').style.display = is03 || is12 ? 'block' : 'none';
    document.getElementById('wind-row-day').style.display = is12 ? 'flex' : 'none';
    document.getElementById('wind-row-night').style.display = is03 ? 'flex' : 'none';
    document.getElementById('wind-row-24h').style.display = is03 ? 'flex' : 'none';
}

function onWindDirectionChange() {
    const dd = document.getElementById('windDD').value;
    const wsEl = document.getElementById('windWS');

    if (dd === '00') {
        wsEl.value = '0';
        wsEl.setAttribute('readonly', 'readonly');
    } else {
        wsEl.removeAttribute('readonly');
    }
}

function parseTenthsInteger(id) {
    const raw = parseFloat(document.getElementById(id).value);
    if (isNaN(raw)) {
        return NaN;
    }
    return raw / 10;
}

function lookupWindAverage(rangeTable, diff) {
    if (isNaN(diff) || diff < 0) {
        return null;
    }

    for (let i = 0; i < rangeTable.length; i += 1) {
        const r = rangeTable[i];
        if (diff >= r.from && diff <= r.to) {
            return r.value;
        }
    }

    return null;
}

function formatWindPair(kmph, kt) {
    if (kmph === null || kt === null) {
        return '--';
    }
    return pad2(kmph) + '/' + pad2(kt);
}

function solveWindAverages() {
    const utc = document.getElementById('utcSlot').value;

    let ktDay = null;
    let ktNight = null;
    let kt24 = null;

    let kmphDay = null;
    let kmphNight = null;
    let kmph24 = null;

    if (utc === '12') {
        const current12 = parseTenthsInteger('wind12Current');
        const previous03 = parseTenthsInteger('wind03Previous');
        const diff = current12 - previous03;

        ktDay = lookupWindAverage(windKt0830to1730, diff);
        kmphDay = lookupWindAverage(windKmph0830to1730, diff);
    }

    if (utc === '03') {
        const current03 = parseTenthsInteger('wind03Current');
        const previous03 = parseTenthsInteger('wind03PreviousFor03');
        const previous12 = parseTenthsInteger('wind12Previous');

        const diffNight = current03 - previous12;
        const diff24 = current03 - previous03;

        ktNight = lookupWindAverage(windKt1730prevTo0830, diffNight);
        kmphNight = lookupWindAverage(windKmph1730prevTo0830, diffNight);

        kt24 = lookupWindAverage(windKt0830prevTo0830, diff24);
        kmph24 = lookupWindAverage(windKmph0830prevTo0830, diff24);
    }

    document.getElementById('res-wind-day').innerText = formatWindPair(kmphDay, ktDay);
    document.getElementById('res-wind-night').innerText = formatWindPair(kmphNight, ktNight);
    document.getElementById('res-wind-24h').innerText = formatWindPair(kmph24, kt24);
}

function formatTenthsHintValue(inputId) {
    const raw = parseFloat(document.getElementById(inputId).value);
    if (isNaN(raw)) {
        return '--';
    }
    return (raw / 10).toFixed(1);
}

function updateTenthsHints() {
    const tenthsFields = [
        'wind12Current',
        'wind03Previous',
        'wind03Current',
        'wind03PreviousFor03',
        'wind12Previous',
        'rainR',
        'rainRtot'
    ];

    tenthsFields.forEach((id) => {
        const hintEl = document.getElementById('hint-' + id);
        if (hintEl) {
            hintEl.innerText = formatTenthsHintValue(id);
        }
    });
}

function solveVisibility() {
    const vis = parseFloat(document.getElementById('visibilityMeters').value);
    if (isNaN(vis) || vis < 0) {
        document.getElementById('res-vv').innerText = '--';
        return;
    }

    const utc = document.getElementById('utcSlot').value;
    const useNight = ['15', '18', '21', '00'].includes(utc);
    const vv = useNight ? visibilityCodeNight(vis) : visibilityCodeDay(vis);
    document.getElementById('res-vv').innerText = vv;
}

function visibilityCodeDay(vis) {
    if (vis < 50) return '90';
    if (vis < 200) return '91';
    if (vis < 500) return '92';
    if (vis < 1000) return '93';
    if (vis < 2000) return '94';
    if (vis < 4000) return '95';
    if (vis < 10000) return '96';
    if (vis < 20000) return '97';
    if (vis < 50000) return '98';
    return '99';
}

function visibilityCodeNight(vis) {
    if (vis < 100) return '90';
    if (vis < 330) return '91';
    if (vis < 740) return '92';
    if (vis < 1340) return '93';
    if (vis < 2300) return '94';
    if (vis < 4000) return '95';
    if (vis < 7500) return '96';
    if (vis < 12000) return '97';
    return '98';
}

function pad2(v) {
    return String(v).padStart(2, '0');
}

function pad3(v) {
    return String(v).padStart(3, '0');
}

function tempGroup(prefix, tempValue) {
    if (isNaN(tempValue)) {
        return null;
    }

    const isNegative = tempValue < 0;
    const ttt = Math.round(Math.abs(tempValue) * 10);
    return String(prefix) + (isNegative ? '1' : '0') + pad3(ttt);
}

function pressurePoGroup(slp) {
    if (isNaN(slp)) {
        return null;
    }
    const p = Math.round(slp * 10);
    return '3' + pad4(p % 10000);
}

function pressureMslpGroup(mslp) {
    if (isNaN(mslp)) {
        return null;
    }
    const p = Math.round(mslp * 10);
    return '4' + pad4(p % 10000);
}

function pad4(v) {
    return String(v).padStart(4, '0');
}

function getMslpNumeric() {
    const text = document.getElementById('res-mslp').innerText;
    const n = parseFloat(text);
    return isNaN(n) ? NaN : n;
}

function getP24Numeric() {
    const text = document.getElementById('res-p24').innerText;
    const n = parseFloat(text);
    return isNaN(n) ? NaN : n;
}

function nCloudCode(nl, nm) {
    if (nl > 0) {
        return nl;
    }
    if (nm > 0) {
        return nm;
    }
    return 0;
}

function rainCodeFromTenthsMm(mmTenthsRaw) {
    if (isNaN(mmTenthsRaw)) {
        return null;
    }

    const mm = mmTenthsRaw / 10;
    if (mm <= 0) {
        return null;
    }

    if (mm > 0 && mm < 1) {
        return '995';
    }

    return pad3(Math.round(mm));
}

function buildSynop() {
    const utc = document.getElementById('utcSlot').value;
    const now = new Date();

    const yy = pad2(now.getUTCDate());
    const gg = utc;

    const station = '42542';

    const rtot = parseTenthsInteger('rainRtot');
    const ww = document.getElementById('weatherWW').value;
    const ix = ww === '00' ? '2' : '1';
    const ir = !isNaN(rtot) && rtot > 0 ? '2' : '3';

    const hc = document.getElementById('cloudHc').value;
    const vv = document.getElementById('res-vv').innerText === '--' ? '//' : document.getElementById('res-vv').innerText;

    const nc = clampCodeValue('cloudNc');
    const dd = document.getElementById('windDD').value;
    const ws = Math.max(0, Math.min(99, Math.round(parseFloat(document.getElementById('windWS').value) || 0)));

    const t = parseFloat(document.getElementById('T_db').value);
    const dpText = document.getElementById('res-dp').innerText;
    const dp = parseFloat(dpText);

    const slp = parseFloat(document.getElementById('targetSLP').value);
    const mslp = getMslpNumeric();

    const w1 = document.getElementById('weatherW1').value;
    const w2 = document.getElementById('weatherW2').value;

    const cl = document.getElementById('cloudCl').value;
    const cm = document.getElementById('cloudCm').value;
    const ch = document.getElementById('cloudCh').value;
    const nl = clampCodeValue('cloudNl');
    const nm = clampCodeValue('cloudNm');

    const tMax = parseFloat(document.getElementById('tMax').value);
    const tMin = parseFloat(document.getElementById('tMin').value);

    const p24 = getP24Numeric();

    const lines = [];
    lines.push('AAXX');
    lines.push(yy + gg + '4');
    lines.push(station);
    lines.push(ir + ix + hc + vv);
    lines.push(String(nc) + dd + pad2(ws));

    const tGroup = tempGroup('1', t);
    const tdGroup = tempGroup('2', dp);
    const poGroup = pressurePoGroup(slp);
    const mslpGroup = pressureMslpGroup(mslp);

    if (tGroup) lines.push(tGroup);
    if (tdGroup) lines.push(tdGroup);
    if (poGroup) lines.push(poGroup);
    if (mslpGroup) lines.push(mslpGroup);

    if (ww !== '00') {
        lines.push('7' + ww + w1 + w2);
    }

    if (nc > 0) {
        lines.push('8' + String(nCloudCode(nl, nm)) + cl + cm + ch);
    }
    lines.push('333');

    if (utc === '03' || utc === '12') {
        const tmaxGroup = tempGroup('1', tMax);
        if (tmaxGroup) lines.push(tmaxGroup);
    }

    if (utc === '03') {
        const tminGroup = tempGroup('2', tMin);
        if (tminGroup) lines.push(tminGroup);
    }

    if (!isNaN(p24)) {
        const x = p24 > 0 ? '8' : '9';
        const ppp = pad3(Math.round(Math.abs(p24) * 10));
        lines.push('5' + x + ppp);
    }

    const rCode = rainCodeFromTenthsMm(parseFloat(document.getElementById('rainRtot').value));
    if (rCode) {
        lines.push('6' + rCode + '/');
    }

    if (utc === '03') {
        const rtotRawTenths = parseFloat(document.getElementById('rainRtot').value);
        const srfRaw = parseFloat(document.getElementById('rainSRF').value);
        const section555 = [];

        if (!isNaN(rtotRawTenths)) {
            section555.push('0' + pad4(Math.round(Math.abs(rtotRawTenths))));
        }

        if (!isNaN(srfRaw)) {
            section555.push('1' + pad4(Math.round(Math.abs(srfRaw))));
        }

        if (section555.length > 0) {
            lines.push('555');
            section555.forEach((g) => lines.push(g));
        }
    }

    document.getElementById('synopOutput').innerText = lines.join('\n');
}

function clampCodeValue(id) {
    const n = Math.round(parseFloat(document.getElementById(id).value) || 0);
    return Math.max(0, Math.min(8, n));
}

function syncPastWeatherSelection() {
    const w1El = document.getElementById('weatherW1');
    const w2El = document.getElementById('weatherW2');
    const w1 = parseInt(w1El.value, 10);
    let w2 = parseInt(w2El.value, 10);

    Array.from(w2El.options).forEach((opt) => {
        const code = parseInt(opt.value, 10);
        opt.disabled = code > w1;
    });

    if (w2 > w1) {
        w2 = w1;
        w2El.value = String(w1);
    }
}

function enforceCloudFormRules() {
    const pairs = [
        { amountId: 'cloudNl', formId: 'cloudCl' },
        { amountId: 'cloudNm', formId: 'cloudCm' },
        { amountId: 'cloudNh', formId: 'cloudCh' }
    ];

    pairs.forEach((pair) => {
        const amount = clampCodeValue(pair.amountId);
        if (amount === 0) {
            document.getElementById(pair.formId).value = '0';
        }
    });
}

function fillSelect(selectId, options, defaultValue) {
    const el = document.getElementById(selectId);
    el.innerHTML = '';
    options.forEach((item) => {
        const opt = document.createElement('option');
        opt.value = item.code;
        opt.textContent = item.code + ' - ' + item.label;
        el.appendChild(opt);
    });
    if (defaultValue !== undefined) {
        el.value = defaultValue;
    }
}

function nextUtcSlot() {
    const now = new Date();
    const h = now.getUTCHours();
    const m = now.getUTCMinutes();
    const exactSlot = m === 0 && h % 3 === 0;
    const base = exactSlot ? h : h + 1;
    const next = (Math.ceil(base / 3) * 3) % 24;
    return pad2(next);
}

function copyAll() {
    const out = document.getElementById('synopOutput').innerText;
    const onCopied = () => {
        const btn = document.querySelector('.btn-primary');
        const prev = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => {
            btn.textContent = prev;
        }, 900);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(out).then(onCopied).catch(() => {});
        return;
    }

    const ta = document.createElement('textarea');
    ta.value = out;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    onCopied();
}

function toggleTheme() {
    const body = document.body;
    const current = body.getAttribute('data-theme');
    const target = current === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', target);
    localStorage.setItem('theme', target);
}

window.onload = () => {
    fillSelect('windDD', windDirectionOptions, '00');
    fillSelect('cloudHc', cloudHeightOptions, '9');
    fillSelect('cloudCl', cloudClOptions, '0');
    fillSelect('cloudCm', cloudCmOptions, '0');
    fillSelect('cloudCh', cloudChOptions, '0');
    fillSelect('weatherWW', significantWeatherOptions, '00');
    fillSelect('weatherW1', pastWeatherOptions, '0');
    fillSelect('weatherW2', pastWeatherOptions, '0');

    document.getElementById('utcSlot').value = nextUtcSlot();
    onWindDirectionChange();

    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    solveAll();
};
