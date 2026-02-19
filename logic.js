function solveAll() {
    solveTemperature();
    solvePressure();
    solveRain();
    solveWind();
}

function solveWind() {
    const currRaw = parseFloat(document.getElementById('windCurrent').value);
    const prevRaw = parseFloat(document.getElementById('windPrevious').value);

    if (isNaN(currRaw) || isNaN(prevRaw)) {
        ['0817', '1708', '0808'].forEach(suffix => {
            document.getElementById(`w-kmph-${suffix}`).innerText = "--";
            document.getElementById(`w-kt-${suffix}`).innerText = "--";
        });
        return;
    }

    // Last digit is decimal
    const current = currRaw / 10;
    const previous = prevRaw / 10;
    
    // Handle rollover (assuming 5 digit anemometer e.g. 9999.9)
    let diff = current - previous;
    if (diff < 0) {
        diff += 10000; // Adjust based on common anemometer limits if needed
    }

    const findVal = (table, diff, rangeKey) => {
        const entry = table.find(row => diff >= row[rangeKey][0] && diff <= row[rangeKey][1]);
        return entry ? entry.v : "--";
    };

    document.getElementById('w-kmph-0817').innerText = findVal(windKmphTable, diff, 'r0817');
    document.getElementById('w-kmph-1708').innerText = findVal(windKmphTable, diff, 'r1708');
    document.getElementById('w-kmph-0808').innerText = findVal(windKmphTable, diff, 'r0808');

    document.getElementById('w-kt-0817').innerText = findVal(windKtTable, diff, 'r0817');
    document.getElementById('w-kt-1708').innerText = findVal(windKtTable, diff, 'r1708');
    document.getElementById('w-kt-0808').innerText = findVal(windKtTable, diff, 'r0808');
}

function solveTemperature() {
    const P_ctx = 900; 
    const T = parseFloat(document.getElementById('T_db').value);
    const Tw = parseFloat(document.getElementById('T_wb').value);

    if (isNaN(T) || isNaN(Tw)) {
        document.getElementById('res-dp').innerText = "--";
        document.getElementById('res-rh').innerText = "--";
        document.getElementById('res-vp').innerText = "--";
        return;
    }

    const ew = 6.11 * Math.pow(10, (7.5 * Tw) / (237.3 + Tw));
    const e = ew - (0.000799 * P_ctx * (T - Tw));
    const es = 6.11 * Math.pow(10, (7.5 * T) / (237.3 + T));
    const rh = Math.round(Math.max(0, Math.min(100, (e / es) * 100)));
    const dp = (237.3 * Math.log10(e / 6.11)) / (7.5 - Math.log10(e / 6.11));

    document.getElementById('res-dp').innerText = dp.toFixed(1) + " °C";
    document.getElementById('res-rh').innerText = rh + "%";
    document.getElementById('res-vp').innerText = e.toFixed(1) + " hPa";
}

function solvePressure() {
    const tK = parseFloat(document.getElementById('barT').value);
    const slp = parseFloat(document.getElementById('targetSLP').value);
    const prevSlp = parseFloat(document.getElementById('prevSLP').value);
    const dbTemp = parseFloat(document.getElementById('T_db').value);
    const instC = parseFloat(document.getElementById('instrC').value) || 0;

    if (isNaN(tK) || isNaN(slp)) return;

    // 1. P24 Calculation
    if (!isNaN(prevSlp)) {
        const diff = slp - prevSlp;
        document.getElementById('res-p24').innerText = (diff >= 0 ? "+" : "") + diff.toFixed(1) + " hPa";
    } else {
        document.getElementById('res-p24').innerText = "--";
    }

    // 2. Table I (Barometer Correction)
    const roundedT = (Math.round(tK * 2) / 2).toFixed(1);
    const colIdxI = slp <= 930 ? 0 : slp <= 950 ? 1 : slp <= 970 ? 2 : slp <= 990 ? 3 : 4;
    const entryI = barTable[roundedT];

    if (entryI) {
        const t1Corr = entryI[colIdxI];
        const sign = parseFloat(roundedT) > 274.0 ? -1 : 1;
        const finalT1 = sign * t1Corr;
        const readingP = slp - instC - finalT1;

        document.getElementById('res-table1').innerText = (sign > 0 ? "+" : "-") + t1Corr.toFixed(1);
        document.getElementById('res-instr-reading').innerText = readingP.toFixed(1) + " hPa";
    }

    // 3. Table II (MSLP Reduction)
    if (!isNaN(dbTemp)) {
        const rowKey = Object.keys(dryBulbTable).find(k => {
            const [min, max] = k.split('-').map(Number);
            return dbTemp >= min && dbTemp <= max;
        });
        const colIdxII = Math.round((slp - 930) / 2);
        const entryII = dryBulbTable[rowKey];

        if (entryII && entryII[colIdxII]) {
            const t2Corr = entryII[colIdxII];
            document.getElementById('res-table2').innerText = "+" + t2Corr.toFixed(1);
            document.getElementById('res-mslp').innerText = (slp + t2Corr).toFixed(1) + " hPa";
        }
    }
}

function solveRain() {
    const selectedUTC = document.getElementById('synopUTC').value;
    const rain03zFields = document.querySelectorAll('.rain-03z-specific');

    if (selectedUTC === '03') {
        rain03zFields.forEach(field => field.style.display = 'grid');
    } else {
        rain03zFields.forEach(field => field.style.display = 'none');
    }
    
    // Retrieve values (even if hidden, for completeness)
    const rainSinceLast = parseFloat(document.getElementById('rainSinceLast').value);
    const rainTotal = parseFloat(document.getElementById('rainTotal').value);
    const rain24hr = parseFloat(document.getElementById('rain24hr').value);
    const seasonalRainfall = parseFloat(document.getElementById('seasonalRainfall').value);

    // No calculations specified yet, just ensuring values are accessible.
    // console.log(`Rain Since Last: ${rainSinceLast}, Total Rain: ${rainTotal}, R24: ${rain24hr}, SRF: ${seasonalRainfall}`);
}

// Fixed Theme Toggle logic
function toggleTheme() {
    const body = document.body;
    const current = body.getAttribute('data-theme');
    const target = current === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', target);
    localStorage.setItem('theme', target);
}

function setUpcomingUTC() {
    const now = new Date();
    const currentHour = now.getUTCHours();
    
    // Synoptic hours: 0, 3, 6, 9, 12, 15, 18, 21
    // The "upcoming" UTC is the next one in the sequence.
    // If it's 10 UTC, next is 12 UTC. If it's 22 UTC, next is 00 UTC.
    
    const synopHours = [0, 3, 6, 9, 12, 15, 18, 21];
    let upcoming = synopHours[0];
    
    for (let hour of synopHours) {
        if (hour > currentHour) {
            upcoming = hour;
            break;
        }
    }
    
    // Pad with leading zero for the value attribute
    const val = upcoming.toString().padStart(2, '0');
    document.getElementById('synopUTC').value = val;
}

window.onload = () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    setUpcomingUTC();
    solveAll();
};