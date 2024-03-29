#!/usr/bin/env python
import os
import shutil
import subprocess


def srt2txt(srtfile, txtfile, meta, deltags, gap):
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
            if debug: print("META", entry)

    ok = True
    last_idx = 0
    last_end = 0
    state = SRTState.NUMBER
    # SRT data structure:
    #   NUMBER\n
    #   start_time --> end_time POSITIONS\n
    #   STRINGS\n
    #     where STRINGS can have "<tag>" or "{tag}"
    srtdata = srtfile.read()
    tagr = re.compile(r'(\{[^}]*\}|<[^>]*>)')
    txt = ""
    for line in srtdata.splitlines(True):
        if state == SRTState.NUMBER:
            try:
                subnum = int(line)
            except ValueError as e:
                print("Invalid value in", last_idx)
                print(e)
                if deltags:
                    print(re.sub(tagr, '', line).rstrip(" \n"), file=txtfile)
                else:
                    print(line.rstrip(" \n"), file=txtfile)
                ok = False
                continue
            if subnum - last_idx != 1:
                print("Skipped?", subnum, end="")
                print(" from", last_idx)
                ok = False
            last_idx = subnum
            state = SRTState.TIMES
            if debug: print("NUMBER", subnum)
        elif state == SRTState.TIMES:
            start_time, arrow, end_time = line.split(" ")
            if arrow != "-->":
                print("Invalid timestamp", line)
                ok = False
                continue
            state = SRTState.STRINGS
            if debug: print("TIME", start_time, "-->", end_time)
        elif state == SRTState.STRINGS:
            if len(line.rstrip("\n")) > 0:
                txt += line.rstrip(" \r\n") + " "
            else:
                diff = to_ms(start_time) - last_end
                if diff > gap:
                    print("", file=txtfile)
                if deltags:
                    txt = re.sub(tagr, '', txt)
                print(txt, file=txtfile)
                last_end = to_ms(end_time)
                state = SRTState.NUMBER
                txt = ""
    print(txt, file=txtfile)
    return ok


def metainfo(mp4, ffprobe):
    meta = []
    probe = subprocess.Popen([ffprobe,
                              "-loglevel", "error",
                              "-show_entries",
                              "format_tags=title,album,copyright",
                              "-of", "default=noprint_wrappers=1:nokey=1",
                              mp4],
                             stdout=subprocess.PIPE)
    for line in probe.stdout:
        meta.append(line.decode().rstrip())
    return meta


def ff_download():
    import zipfile
    url = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
    zipname = "ffmpeg.zip"
    powershell = shutil.which("powershell.exe")
    if powershell == None:
        return None, None
    subprocess.run([powershell, "-Command", "wget", url, "-OutFile", zipname])
    with zipfile.ZipFile(zipname, "r") as z:
        for item in z.infolist():
            for target in ["ffmpeg.exe", "ffprobe.exe"]:
                if item.filename.endswith("/" + target):
                    with z.open(item) as zexe:
                        with open(target, "wb") as wexe:
                            wexe.write(zexe.read())
    ffmpeg = shutil.which("ffmpeg.exe", mode=os.F_OK)
    ffprobe = shutil.which("ffprobe.exe", mode=os.F_OK)
    return ffmpeg, ffprobe


if __name__ == '__main__':
    import sys
    import argparse
    from builtins import input
    import traceback

    pwd = os.getcwd()
    os.chdir(os.path.dirname(sys.argv[0]))
    ffmpeg = shutil.which("ffmpeg.exe", mode=os.F_OK)
    ffprobe = shutil.which("ffprobe.exe", mode=os.F_OK)
    if ffmpeg == None or ffprobe == None:
        print("Not found: ffmpeg or ffprobe")
        key = input("Download ffmpeg? [y/N] ")
        if len(key) > 0 and (key[0] == "y" or key[0] == "Y"):
            ffmpeg, ffprobe = ff_download()
            if ffmpeg == None or ffprobe == None:
                print("Failed to install ffmpeg.")
                input("Press ENTER key to exit.")
                sys.exit()
        else:
            input("Press ENTER key to exit.")
            sys.exit()
    ffmpeg = os.path.abspath(ffmpeg)
    ffprobe = os.path.abspath(ffprobe)
    os.chdir(pwd)

    parser = argparse.ArgumentParser(description='Extract text from MP4')
    parser.add_argument('files', metavar='mp4',
                        nargs='*',
                        help='MP4 files')
    parser.add_argument('-t', '--tags',
                        action='store_true',
                        help='Keep tags')
    parser.add_argument('-g', '--gap', metavar='MS',
                        type=int, default=1000,
                        help='Newlines represent silence longer than MS')
    parser.add_argument('-d', '--debug',
                        action='store_true',
                        help='Verbose output and keep SRT')
    args = parser.parse_args()
    debug = args.debug
    if debug: print("Using", ffmpeg, "and", ffprobe)

    if len(args.files) == 0:
        import tkinter
        from tkinter import filedialog
        print("No filenames given. Please specify the files to use.")
        tkinter.Tk().withdraw()
        files = filedialog.askopenfilenames(filetypes=[("", "*.mp4")])
    else:
        files = map(os.path.abspath, args.files)
    if debug: print("FILES", files)

    for mp4 in files:
        try:
            print("Extracting:", mp4)
            meta = metainfo(mp4, ffprobe)
            srt = mp4 + ".srt"
            ret = subprocess.run([ffmpeg,
                                  "-loglevel", "error",
                                  "-y",
                                  "-i", mp4,
                                  srt]).returncode
            if ret == 0:
                with open(srt, 'r', encoding="utf-8") as srtfile:
                    with open(mp4 + ".txt", 'w', encoding="utf-8") as txtfile:
                        ok = srt2txt(srtfile, txtfile, meta, not args.tags, args.gap)
                        print("Done:      ", txtfile.name,
                              "(OK)" if ok == True else "(ERROR)")
                        if ok == False:
                            raise ValueError("Invalid data in the SRT file")
                if debug:
                    input("Press ENTER key. (debug mode)")
                else:
                    os.remove(srt)
            else:  # without subtitle?
                print("Press ENTER to continue.")
                key = input("Or press q and ENTER sequentially, to abort.")
                if len(key) > 0 and (key[0] == "q" or key[0] == "Q"):
                    sys.exit()
                else:
                    continue
        except Exception as e:  # bug?
            print(traceback.format_exc())
            input("Press ENTER key to exit.")
            sys.exit()
