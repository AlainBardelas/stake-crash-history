const resultsDiv = document.querySelector('#results');
const loadingDiv = document.querySelector('#loading');
const statisticsDiv = document.querySelector('#statistics');
const seedInput = document.querySelector('#seed_input');
const usBlockHashCheckbox = document.querySelector('#use_stake_us_block_hash');
const updateButton = document.querySelector('#update_button');
const crashesCount = document.querySelector('#crashes_count');
const exportCsvButton = document.querySelector('#export_csv_button');
const exportJsonButton = document.querySelector('#export_json_button');

const blockHash = '0000000000000000001b34dc6a1e86083f95500b096231436e9b25cbdd0075c4';
const usBlockHash = '000000000000000000066448f2f56069750fc40c718322766b6bdf63fdcf45b8';

const amountInput = document.querySelector('#amount_input');
const goodValueInput = document.querySelector('#good_value_input');
let currentCrashHistory = null;

// loading values.
amountInput.value = localStorage.getItem('amount') ?? 100;
goodValueInput.value = localStorage.getItem('goodValue') ?? 2;
usBlockHashCheckbox.checked = localStorage.getItem('usBlockHash') == 'true';

let timeout = null;

seedInput.addEventListener('keyup', (ev) => {
	if (ev.key == 'Enter') {
		ev.preventDefault();

		OnInputChange();
	}
});

$(resultsDiv).selectable({
	stop: UpdateSelectionWindow,
});

seedInput.addEventListener('input', (ev) => {
	OnInputChange();
});
amountInput.addEventListener('input', (ev) => {
	OnInputChange();

	const amount = parseInt(amountInput.value);

	if (isNaN(amount)) return;
	localStorage.setItem('amount', amount);
});
goodValueInput.addEventListener('input', (ev) => {
	OnInputChange();

	const goodValue = parseFloat(goodValueInput.value);

	if (isNaN(goodValue)) return;
	localStorage.setItem('goodValue', goodValue);
});
usBlockHashCheckbox.addEventListener('change', (ev) => {
	OnInputChange();

	localStorage.setItem('usBlockHash', usBlockHashCheckbox.checked);
});

updateButton.addEventListener('click', (ev) => {
	OnInputChange(true);
});

exportCsvButton.addEventListener('click', () => {
	DownloadCsv();
});

exportJsonButton.addEventListener('click', () => {
	DownloadJson();
});

function OnInputChange(byButton = false) {
	clearTimeout(timeout);

	if (!seedInput.value) {
		loadingDiv.innerHTML = '';
		resultsDiv.innerHTML = '';
		statisticsDiv.classList.add('hide');
		currentCrashHistory = null;
		SetExportButtonsEnabled(false);
		return;
	}

	let seed = seedInput.value;

	let amount = parseInt(amountInput.value);
	if (!amount && amount !== 0) amount = 100;

	HandleUpdateButtonVisibility(amount);

	if (amount >= 5000 && !byButton) {
		loadingDiv.innerHTML = '';
		currentCrashHistory = null;
		SetExportButtonsEnabled(false);
		return;
	}

	let goodValue = parseFloat(goodValueInput.value);
	if (!goodValue && goodValue !== 0) goodValue = 2;

	if (amount < 800) {
		GetChain(seed, amount, goodValue);
	} else {
		loadingDiv.innerHTML = 'Loading...';
		currentCrashHistory = null;
		SetExportButtonsEnabled(false);
		timeout = setTimeout(() => {
			GetChain(seed, amount, goodValue);
			loadingDiv.innerHTML = '';
		}, 500);
	}

	UpdateSelectionWindow();
}

function GetChain(seed, amount = 1000, goodValue = 2) {
	resultsDiv.innerHTML = '';

	const history = BuildCrashHistory(seed, amount, goodValue);
	currentCrashHistory = history;

	let goodCount = 0;
	let totalCount = history.crashes.length;

	for (let crash of history.crashes) {
		let multiplier = crash.multiplier;
		const isGood = crash.isGood;
		if (isGood) goodCount++;

		const div = document.createElement('div');
		div.textContent = multiplier.toFixed(2) + 'X';
		div.className = `crash ${isGood ? 'bom' : 'ruim'}`;
		resultsDiv.appendChild(div);
	}

	UpdateStatistics(totalCount, goodCount);
	SetExportButtonsEnabled(totalCount > 0);
}

function BuildCrashHistory(seed, amount = 1000, goodValue = 2) {
	let chain = [seed];
	amount -= 1;

	if (amount < 0) chain = [];
	const selectedBlockHash = usBlockHashCheckbox.checked ? usBlockHash : blockHash;
	const blockHashSource = usBlockHashCheckbox.checked ? 'stake.us' : 'stake.com';

	for (let i = 0; i < amount; i++) {
		chain.push(
			CryptoJS.algo.SHA256.create()
				.update(chain[chain.length - 1])
				.finalize()
				.toString(CryptoJS.enc.Hex)
		);
	}

	const seedToPoint = (seed, i) => {
		const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, seed);
		hmac.update(selectedBlockHash);

		const hex = hmac.finalize().toString(CryptoJS.enc.Hex).substring(0, 8);
		const dec = parseInt(hex, 16);
		const f = parseFloat((4294967296 / (dec + 1)) * (1 - 0.01));

		const point = parseFloat((Math.floor(f * 100) / 100).toFixed(2));

		return {
			index: i + 1,
			hash: seed,
			multiplier: point,
			isGood: point >= goodValue,
		};
	};

	return {
		metadata: {
			seed,
			amount: chain.length,
			goodValue,
			blockHash: selectedBlockHash,
			blockHashSource,
			generatedAt: new Date().toISOString(),
		},
		crashes: chain.map(seedToPoint),
	};
}

function UpdateStatistics(totalCount = 0, goodCount = 0) {
	if (!totalCount) {
		statisticsDiv.classList.add('hide');
		return;
	}

	statisticsDiv.classList.remove('hide');
	const lossCount = totalCount - goodCount;
	const goodPercentage = ((goodCount / totalCount) * 100).toFixed(2);
	const lossPercentage = ((lossCount / totalCount) * 100).toFixed(2);

	statisticsDiv.innerHTML = `<span class="good">${goodCount}</span>/${totalCount} Wins (<span class="good">${goodPercentage}%</span> Chance) • <span class="bad">${lossCount}</span>/${totalCount} Losses (<span class="bad">${lossPercentage}%</span> Chance)`;
}

function UpdateSelectionWindow() {
	let selectedElements = document.querySelectorAll('.ui-selected');
	// console.log(selectedElements);
	if (selectedElements.length == 0) {
		crashesCount.classList.add('hide');
		return;
	} else {
		crashesCount.classList.remove('hide');
	}

	let goodElements = document.querySelectorAll('.ui-selected.bom');
	let count = selectedElements.length;
	let goodCount = goodElements.length;

	crashesCount.innerHTML = `
        <div>${count} selected</div>
        <div><span class="good">${goodCount}</span>/${count}</div>
    `;
}

function HandleUpdateButtonVisibility(amount) {
	if (amount >= 5000) {
		updateButton.classList.remove('hide');
	} else {
		updateButton.classList.add('hide');
	}
}

function SetExportButtonsEnabled(enabled) {
	exportCsvButton.disabled = !enabled;
	exportJsonButton.disabled = !enabled;
}

function DownloadJson() {
	if (!currentCrashHistory) return;

	DownloadFile(
		JSON.stringify(currentCrashHistory, null, 2),
		'application/json',
		GetExportFilename('json')
	);
}

function DownloadCsv() {
	if (!currentCrashHistory) return;

	const { metadata, crashes } = currentCrashHistory;
	const columns = [
		'index',
		'hash',
		'multiplier',
		'is_good',
		'seed',
		'good_value',
		'block_hash_source',
		'block_hash',
	];

	const rows = crashes.map((crash) => [
		crash.index,
		crash.hash,
		crash.multiplier.toFixed(2),
		crash.isGood,
		metadata.seed,
		metadata.goodValue,
		metadata.blockHashSource,
		metadata.blockHash,
	]);

	const csv = [columns, ...rows]
		.map((row) => row.map(EncodeCsvValue).join(','))
		.join('\n');

	DownloadFile(csv, 'text/csv', GetExportFilename('csv'));
}

function EncodeCsvValue(value) {
	const text = String(value);
	return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function DownloadFile(content, type, filename) {
	const blob = new Blob([content], { type });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

function GetExportFilename(extension) {
	const timestamp = currentCrashHistory.metadata.generatedAt.replace(/[:.]/g, '-');
	return `stake-crash-history-${timestamp}.${extension}`;
}
