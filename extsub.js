const uplabel = document.getElementById("uplabel");
const uploader = document.getElementById("uploader");
const subs = document.getElementById("subs");
const logs = document.getElementById("logs");
const dlbutton = document.getElementById("dlbutton");

dlbutton.addEventListener('click',
  function(){
    location.href='https://drive.google.com/file/d/1ythD8rjbzpV0ZQOrBfyv4_Q74WSUyMQK/view?usp=sharing';
  });

logs.textContent = "ロード中...";

if (!self.crossOriginIsolated) {
  logs.textContent += "\n[http-error] 対応していないかもしれません (crossOriginIsolated == false)";
  subs.innerHTML = '<label id="refresh">やり直し</label>';
  subs.style.display = "block";
  document.getElementById("refresh").addEventListener('click',
    function(){
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

ffmpeg.on("log", ({type, message}) => {
 logs.textContent += "\n[" + type + "] " + message;
 if (type == "stderr") {
  function replacer(match, m1, m2, offset, string) {
   return m1+":"+m2;
  }
  var propvalue = message.replace(/^ +(title|album|copyright) *: (.+)$/, replacer).split(":", 2);
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

const rip3g = data => {
 const decoder = new TextDecoder();
 let out = "";
 let len = 0;
 let end = "";
 for(let i = 0; i+1 < data.length; i += 2 + len) {
  len = data[i+1];
  if(len) { end = "<br />"; }
  else { end = ""; }
  out += decoder.decode(data.slice(i+2, i+2+len)) + end;
 }
 return out;
};

function saveas(txt, filename){
  var l=document.createElement('a');
  l.href='data:text/plain;charset=utf-8;base64,'+window.btoa(
    encodeURIComponent(txt).replace(/%([0-9A-F]{2})/g,
    function(match, p1){
      return String.fromCharCode(parseInt(p1, 16))
    }));
  l.download=filename + '.txt';
  document.body.appendChild(l);
  l.click();
  document.body.removeChild(l);
}

const extract = async({
 target: {
  files
 }
}) => {
 uplabel.setAttribute("disabled", "true");
 const { name } = files[0];
 const outname = "output.srt";
 try {
  await ffmpeg.writeFile(name, await fetchFile(files[0]));
 } catch(e) {
  logs.textContent += "\n[write-error] " + e.toString();
  subs.style.display = "block";
 }
 try {
  await ffmpeg.exec(["-i", name, "-an", "-vn", "-dn", "-scodec", "copy", "-f", "rawvideo", outname]);
 } catch(e) {
  logs.textContent += "\n[exec-error] " + e.toString();
  subs.style.display = "block";
 }
 ffmpeg.deleteFile(name);
 const textdata = await ffmpeg.readFile(outname);
 ffmpeg.deleteFile(outname);
 const text = rip3g(textdata);
 subs.innerHTML = '<p id="subtext">'
  + title + " (" + album + ")<br />"
  + copyr + "<br /><br />"
  + text + "<br /></p>"
  + '<label id="saveas">ファイルとして保存</label>'
  + '<br /><br /><br />'
  + '<label id="toplabel">トップに戻る</label>';
 subs.style.display = "block";
 document.getElementById("saveas").addEventListener('click',
   function(){
    saveas(document.getElementById("subtext").innerText, name);
   });
 document.getElementById("toplabel").addEventListener('click',
   function(){
    window.scrollTo(0,0);
   });
 uplabel.removeAttribute("disabled");
};

uploader.addEventListener("change", extract);
(async () => {
 try {
  await ffmpeg.load({
    coreURL: "./ffmpeg-core.js",
  });
 } catch(e) {
  logs.textContent += "\n[load-error] " + e.toString();
  throw(e);
 }
 logs.textContent = "準備完了" + logs.textContent.slice("ロード中...".length);
 logs.setAttribute("data-loaded", "true");
 uplabel.style.display = "block";
})();
