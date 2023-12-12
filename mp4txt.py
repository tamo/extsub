#!/usr/bin/env python
import os
import shutil
import subprocess


def srt2txt(srtfile, txtfile, meta, tags, gap):
    import re
    from enum import Enum, auto

    class SRTState(Enum):
        NUMBER = auto()
        TIMES = auto()
        STRINGS = auto()

    def to_ms(timecode):
        t, ms = timecode.split(',')
        h, m, s = t.split(':')
        return (int(h)*3600 + int(m)*60 + int(s))*1000 + int(ms)

    for entry in meta:
        if len(entry) > 0:
            print(entry, file=txtfile)

    ok = True
    last_idx = 0
    last_end = 0
    state = SRTState.NUMBER
    # SRT data structure:
    #   NUMBER\n
    #   start_time --> end_time POSITIONS\n
    #   STRINGS\n
    #     where STRINGS can have "\r\n",
    #     "<tag>", or "{tag}"
    srtdata = srtfile.read().replace("\r\n", " ")
    tagr = re.compile(r'(\{[^}]*\}|<[^>]*>)')
    for line in srtdata.splitlines():
        if state == SRTState.NUMBER:
            try:
                subnum = int(line)
            except ValueError as e:
                print("Invalid value in", last_idx)
                print(e)
                ok = False
                continue
            if subnum - last_idx != 1:
                print("Skipped?", subnum, end="")
                print(" from", last_idx)
                ok = False
            last_idx = subnum
            state = SRTState.TIMES
        elif state == SRTState.TIMES:
            start_time, arrow, end_time = line.split(" ")
            if arrow != "-->":
                print("Invalid timestamp", line)
                ok = False
                continue
            state = SRTState.STRINGS
            txt = ""
        elif state == SRTState.STRINGS:
            if len(line) > 0:
                txt += line.rstrip(" ") + " "
            else:
                diff = to_ms(start_time) - last_end
                if diff > gap:
                    print("", file=txtfile)
                if tags:
                    txt = re.sub(tagr, '', txt)
                print(txt, file=txtfile)
                last_end = to_ms(end_time)
                state = SRTState.NUMBER
    return ok


def metainfo(mp4, ffprobe):
    meta = []
    probe = subprocess.Popen([ffprobe,
                              "-loglevel", "error",
                              "-show_entries",
                              "format_tags=title,copyright",
                              "-of", "default=noprint_wrappers=1:nokey=1",
                              mp4],
                             stdout=subprocess.PIPE)
    for line in probe.stdout:
        meta.append(line.decode().rstrip())
    return meta


def ff_download(dir):
    import zipfile
    url = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
    zipname = os.path.join(dir, "ffmpeg.zip")
    os.system("powershell -Command wget " + url + " -OutFile " + zipname)
    with zipfile.ZipFile(zipname, "r") as z:
        for item in z.infolist():
            for target in ["ffmpeg.exe", "ffprobe.exe"]:
                if item.filename.endswith("/" + target):
                    with z.open(item) as zexe:
                        with open(os.path.join(dir, target), "wb") as wexe:
                            wexe.write(zexe.read())
    ffmpeg = shutil.which("ffmpeg.exe", mode=os.F_OK)
    ffprobe = shutil.which("ffprobe.exe", mode=os.F_OK)
    return ffmpeg, ffprobe


if __name__ == '__main__':
    import sys
    import argparse
    from builtins import input
    import traceback

    cdir = os.path.abspath(os.path.dirname(sys.argv[0]))
    ffmpeg = shutil.which("ffmpeg.exe", mode=os.F_OK)
    ffprobe = shutil.which("ffprobe.exe", mode=os.F_OK)
    if ffmpeg == None or ffprobe == None:
        print("Not found: ffmpeg or ffprobe")
        key = input("Download ffmpeg?")
        if len(key) > 0 and (key[0] == "y" or key[0] == "Y"):
            ffmpeg, ffprobe = ff_download(cdir)
            if ffmpeg == None or ffprobe == None:
                print("Failed to install ffmpeg.")
                input("Press ENTER key to exit.")
                sys.exit()
        else:
            input("Press ENTER key to exit.")
            sys.exit()

    parser = argparse.ArgumentParser(description='Extract text from MP4')
    parser.add_argument('files', metavar='mp4',
                        nargs='*',
                        help='MP4 file')
    parser.add_argument('-t', '--tags',
                        action='store_true',
                        help='Delete tags')
    parser.add_argument('-g', '--gap', metavar='ms',
                        type=int, default=1000,
                        help='Newline as silence')
    args = parser.parse_args()
    files = args.files
    tags = args.tags
    gap = args.gap

    if len(files) == 0:
        import tkinter
        from tkinter import filedialog
        print("No filenames given. Please specify the files to use.")
        tkinter.Tk().withdraw()
        files = filedialog.askopenfilenames(filetypes=[("", "*.mp4")])
    else:
        files = map(os.path.abspath, files)

    for mp4 in files:
        try:
            print("Extracting:", mp4)
            meta = metainfo(mp4, ffprobe)
            srt = mp4 + ".srt"
            ret = subprocess.call([ffmpeg,
                                   "-loglevel", "error",
                                   "-y",
                                   "-i", mp4,
                                   srt])
            if ret == 0:
                with open(srt, 'r', encoding="utf-8") as srtfile:
                    with open(mp4 + ".txt", 'w', encoding="utf-8") as txtfile:
                        ok = srt2txt(srtfile, txtfile, meta, tags, gap)
                        print("Done:      ", txtfile.name,
                              "(OK)" if ok == True else "(ERROR)")
                        if ok == False:
                            raise ValueError("Invalid data in the SRT file")
                os.remove(srt)
            else:  # without subtitle?
                print("Press ENTER to continue.")
                key = input("Or press q and ENTER sequentially, to abort.")
                if len(key) == 0:
                    continue
                elif key[0] == "q" or key[0] == "Q":
                    sys.exit()
        except Exception as e:  # bug?
            print(traceback.format_exc())
            input("Press ENTER key to exit.")
            sys.exit()
