const uplabel = document.getElementById("uplabel");
const uploader = document.getElementById("uploader");
const subs = document.getElementById("subs");
const logs = document.getElementById("logs");
const dlbutton = document.getElementById("dlbutton");

dlbutton.addEventListener("click", function () {
	const l = document.createElement("a");
	l.href = "https://raw.githubusercontent.com/tamo/extsub/main/mp4txt.py";
	l.download = "mp4txt.py";
	document.body.appendChild(l);
	l.click();
	document.body.removeChild(l);
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

if (FFmpegUtil == undefined || FFmpegWASM == undefined) {
	logs.textContent += "\n[js-error] FFmpegがロードできませんでした";
	throw new Error("FFmpeg is not loaded");
}
const fetchFile = FFmpegUtil.fetchFile;
const FFmpeg = FFmpegWASM.FFmpeg;

const ffmpeg = new FFmpeg();

var title = "";
var album = "";
var copyr = "";

ffmpeg.on("log", ({ type, message }) => {
	logs.textContent += `\n[${type}] ${message}`;
	if (type == "stderr") {
		function replacer(match, m1, m2, offset, string) {
			return m1 + ":" + m2;
		}
		var propvalue = message
			.replace(/^ +(title|album|copyright) *: (.+)$/, replacer)
			.split(":", 2);
		switch (propvalue[0]) {
			case "title":
				title = propvalue[1];
				break;
			case "album":
				album = propvalue[1];
				break;
			case "copyright":
				copyr = propvalue[1];
		}
	}
});

// data is a Uint8Array returned by ffmpeg.readFile
// tx3g format is { uint16 len; uint8 text[len]; }[]
const rip3g = (data) => {
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
};

function saveas(txt, filename) {
	const l = document.createElement("a");
	l.href =
		"data:text/plain;charset=utf-8;base64," +
		window.btoa(
			encodeURIComponent(txt).replace(/%([0-9A-F]{2})/g, function (match, p1) {
				return String.fromCharCode(parseInt(p1, 16));
			})
		);
	l.download = filename + ".txt";
	document.body.appendChild(l);
	l.click();
	document.body.removeChild(l);
}

const extract = async ({ target: { files } }) => {
	uplabel.setAttribute("disabled", "true");
	const { name } = files[0];
	const outname = "output.srt";
	try {
		await ffmpeg.writeFile(name, await fetchFile(files[0]));
	} catch (e) {
		logs.textContent += `\n[write-error] ${e.toString()}`;
		subs.style.display = "block";
	}
	try {
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
	} catch (e) {
		logs.textContent += `\n[exec-error] ${e.toString()}`;
		subs.style.display = "block";
	}
	ffmpeg.deleteFile(name);
	const textdata = await ffmpeg.readFile(outname);
	ffmpeg.deleteFile(outname);
	const text = rip3g(textdata);
	subs.innerHTML =
		`<p id="subtext">${title} (${album})<br />${copyr}<br /><br />${text}<br /></p>` +
		'<label id="saveas">ファイルとして保存</label><br /><br /><br />' +
		'<label id="toplabel">トップに戻る</label>';
	subs.style.display = "block";
	document.getElementById("saveas").addEventListener("click", function () {
		saveas(document.getElementById("subtext").innerText, name);
	});
	document.getElementById("toplabel").addEventListener("click", function () {
		window.scrollTo(0, 0);
	});
	uplabel.removeAttribute("disabled");
};

uploader.addEventListener("change", extract);
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
