if (!self.crossOriginIsolated) {
  alert("対応していないかもしれません");
};

const uplabel = document.getElementById("uplabel");
const uploader = document.getElementById("uploader");
const subs = document.getElementById("subs");
const logs = document.getElementById("logs");
const dlbutton = document.getElementById("dlbutton");

dlbutton.addEventListener('click',
  function(){
    location.href='https://drive.google.com/file/d/1ythD8rjbzpV0ZQOrBfyv4_Q74WSUyMQK/view?usp=sharing';
  });

logs.textContent="ロード中...";

const { createFFmpeg , fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });
var title = "";
var album = "";
var copyr = "";

ffmpeg.setLogger(({type, message}) => {
 logs.textContent += "\n[" + type + "] " + message;
 if (type == "fferr") {
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
  await ffmpeg.FS("writeFile", name, await fetchFile(files[0]));
 } catch(e) {
  logs.textContent += "\n[error] " + e.message;
  subs.style.display = "block";
 }
 try {
  await ffmpeg.run("-i", name, "-an", "-vn", "-dn", "-scodec", "copy", "-f", "rawvideo", outname);
 } catch(e) {
  logs.textContent += "\n[error] " + e.message;
  subs.style.display = "block";
 }
 const textdata = ffmpeg.FS("readFile", outname);
 ffmpeg.FS("unlink", outname);
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
  await ffmpeg.load();
 } catch(e) {
  logs.textContent += "\n[error] " + e.message;
  alert("エラーです。\n\n" + e.message);
 }
 logs.textContent = "準備完了" + logs.textContent.slice("ロード中...".length);
 uplabel.style.display = "block";
})();
