const uplabel = document.getElementById("uplabel");
const uploader = document.getElementById("uploader");
const subs = document.getElementById("subs");
const logs = document.getElementById("logs");
const dlbutton = document.getElementById("dlbutton");

dlbutton.addEventListener("click", async function () {
	const pydata = await fetch("./mp4txt.py");
	const pytxt = await pydata.text();
	saveas(pytxt, "mp4txt.py");
});

logs.textContent = "ロード中...";

if (!self.crossOriginIsolated) {
	logs.textContent +=
		"\n[http-error] 対応していないかもしれません (crossOriginIsolated == false)";
	subs.innerHTML = '<label id="refresh">やり直し</label>';
	subs.style.display = "block";
	document.getElementById("refresh").addEventListener("click", function () {
		location.reload();
	});
}

if (!FFmpegUtil || !FFmpegWASM) {
	logs.textContent += "\n[js-error] FFmpegがロードできませんでした";
	throw new Error("FFmpeg is not loaded");
}

const ffmpeg = new FFmpegWASM.FFmpeg();

ffmpeg.on("log", ({ type, message }) => {
	logs.textContent += `\n[${type}] ${message}`;
	if (type == "stderr") {
		const propvalue = message
			.match(/^ +(title|album|copyright) *: (.+)$/);
		if (propvalue?.length != 3) {
			return;
		}
		subs.setAttribute(propvalue[1], propvalue[2]);
	}
});

(async () => {
	try {
		await ffmpeg.load({
			coreURL: "./ffmpeg-core.js",
		});
	} catch (e) {
		logs.textContent += `\n[load-error] ${e.toString()}`;
		if (e.toString().includes("Worker")) {
			logs.textContent += "\n (iOS は 16.4 以上でないと動かないようです)";
		}
		throw e;
	}
	logs.textContent = "準備完了";
	uplabel.style.display = "block";
})();

uploader.addEventListener("change", extract);

async function extract({ target: { files } }) {
	uplabel.setAttribute("disabled", "true");
	subs.innerHTML = '<p>処理中...</p>';
	subs.removeAttribute("title");
	subs.removeAttribute("album");
	subs.removeAttribute("copyright");
	subs.style.display = "block";

	const { name } = files[0];
	const outname = "output.srt";
	try {
		await ffmpeg.writeFile(name, await FFmpegUtil.fetchFile(files[0]));
	} catch (e) {
		subs.innerHTML = '<p>ファイル読み出しエラー</p>';
		logs.textContent += `\n[write-error] ${e.toString()}`;
	}
	try {
		subs.innerHTML = '<p>処理中...<img src="./spinner.svg" /></p>';
		await ffmpeg.exec([
			"-i",
			name,
			"-an",
			"-vn",
			"-dn",
			"-scodec",
			"copy",
			"-f",
			"rawvideo",
			outname,
		]);
		subs.innerHTML = '<p>処理中...</p>';
	} catch (e) {
		subs.innerHTML = '<p>ファイル処理エラー</p>';
		logs.textContent += `\n[exec-error] ${e.toString()}`;
	}
	ffmpeg.deleteFile(name);

	let text;
	const fsnodes = await ffmpeg.listDir('.');
	if (fsnodes.find((n) => n.name == outname)) {
		text = rip3g(await ffmpeg.readFile(outname));
		ffmpeg.deleteFile(outname);
	}

	const title = subs.getAttribute("title");
	const album = subs.getAttribute("album");
	const copyr = subs.getAttribute("copyright");
	subs.innerHTML =
		`<p id="subtext">${title || "No title"}${album ? " (" + album + ")" : ""}<br />` +
		`${copyr || "No copyright"}<br /><br />` +
		`${text || "No data"}<br /></p>` +
		'<label id="saveas">ファイルとして保存</label><br /><br /><br />' +
		'<label id="toplabel">トップに戻る</label>';
	document.getElementById("saveas").addEventListener("click", function () {
		saveas(document.getElementById("subtext").innerText, name + ".txt");
	});
	document.getElementById("toplabel").addEventListener("click", function () {
		window.scrollTo(0, 0);
	});
	uplabel.removeAttribute("disabled");
}

// data is a Uint8Array returned by ffmpeg.readFile
// tx3g format is { uint16 len; uint8 text[len]; }[]
function rip3g(data) {
	const decoder = new TextDecoder();
	let out = "";
	let i = 0;
	while (i + 1 < data.length) {
		const len = (data[i++] << 8) + data[i++];
		if (len) {
			out += decoder.decode(data.slice(i, i += len)) + "<br />";
		}
	}
	return out;
}

function saveas(txt, filename) {
	const l = document.createElement("a");
	l.href =
		"data:text/plain;charset=utf-8;base64," +
		window.btoa(
			encodeURIComponent(txt).replace(/%([0-9A-F]{2})/g, function (match, p1) {
				return String.fromCharCode(parseInt(p1, 16));
			})
		);
	l.download = filename;
	document.body.appendChild(l);
	l.click();
	document.body.removeChild(l);
}
