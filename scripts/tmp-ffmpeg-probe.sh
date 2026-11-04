#!/usr/bin/env bash
# TEMPORARY (ffmpeg 8 investigation for the video tests); removed before merge.
set -u
D=$(mktemp -d)
cd "$D"
F="ffmpeg -hide_banner -loglevel error -y"
SW="flags=accurate_rnd+full_chroma_int"
px() { od -An -tu1 -v -w"$1" | awk -v o="$2" '{printf "%s ", $(o+1)} END {print ""}'; }
echo "== version"; ffmpeg -hide_banner -version | head -1

echo "== (a) grey expansion: lut (expect 156 182, then 0 255)"
$F -f lavfi -i "color=c=black:s=16x16:r=10:d=0.2,format=gray,geq=lum='if(mod(N\,2)\,172\,150)'" -c:v libx265 -pix_fmt gray -x265-params lossless=1:log-level=error -color_range pc gpc.mp4
$F -f lavfi -i "color=c=black:s=16x16:r=10:d=0.2,format=gray,geq=lum='if(mod(N\,2)\,235\,16)',setparams=range=tv" -c:v libx265 -pix_fmt gray -x265-params lossless=1:log-level=error mono.mp4
L="lut=c0='clip(round((val-16)*255/219)\,0\,255)',scale=in_range=pc:out_range=pc,format=yuv444p,scale=in_color_matrix=bt601:in_range=pc:$SW,format=rgb24"
for f in gpc.mp4 mono.mp4; do ffmpeg -hide_banner -loglevel error -i $f -vf "$L" -f rawvideo -pix_fmt rgb24 - | px 768 408; done
echo "   current chain on mono (tv tag):"
ffmpeg -hide_banner -loglevel error -i mono.mp4 -vf "scale=in_range=tv:out_range=tv,format=yuv444p,scale=in_color_matrix=bt601:in_range=tv:$SW,format=rgb24" -f rawvideo -pix_fmt rgb24 - | px 768 408

echo "== (b) yuv tagged pc, told tv (expect 156)"
$F -f lavfi -i "color=c=black:s=16x16:r=10:d=0.1,format=yuv444p,geq=lum=150:cb=128:cr=128,setparams=range=pc" -c:v ffv1 ypc.mkv
ffprobe -v error -show_entries stream=color_range -of csv=p=0 ypc.mkv
for pre in "" "setparams=range=tv,"; do echo -n "   [$pre] "; ffmpeg -hide_banner -loglevel error -i ypc.mkv -vf "${pre}scale=in_color_matrix=bt601:in_range=tv:$SW,format=rgb24" -f rawvideo -pix_fmt rgb24 - | px 768 408; done
echo -n "   tagged pc read pc (expect 150): "; ffmpeg -hide_banner -loglevel error -i ypc.mkv -vf "scale=in_color_matrix=bt601:in_range=pc:$SW,format=rgb24" -f rawvideo -pix_fmt rgb24 - | px 768 408

echo "== (c) alpha composite over white: premultiply vs blend (black opaque 0, white 255, 50% black 128)"
$F -f lavfi -i "color=c=black:s=4x4:d=0.1,format=rgba" -frames:v 1 k.png
$F -f lavfi -i "color=c=white:s=4x4:d=0.1,format=rgba" -frames:v 1 w.png
$F -f lavfi -i "color=c=black@0.5:s=4x4:d=0.1,format=rgba" -frames:v 1 h.png
P="format=rgba,negate,premultiply=inplace=1,negate,format=rgb24"
B="format=rgba,split[c][m];[m]alphaextract,format=gbrp[al];[c]format=gbrp,negate[n];[n][al]blend=all_mode=multiply,negate,format=rgb24"
BK="format=rgba,split[c][m];[m]alphaextract,format=gbrp[al];[c]format=gbrp[n];[n][al]blend=all_mode=multiply,format=rgb24"
for chain in "$P" "$B"; do echo -n "   "; for f in k w h; do ffmpeg -hide_banner -loglevel error -i $f.png -vf "$chain" -f rawvideo -pix_fmt rgb24 - | od -An -tu1 | head -1 | awk '{printf "%s ", $1}'; done; echo; done
echo -n "   over black (0 255 0): "; for f in k w h; do ffmpeg -hide_banner -loglevel error -i $f.png -vf "$BK" -f rawvideo -pix_fmt rgb24 - | od -An -tu1 | head -1 | awk '{printf "%s ", $1}'; done; echo
$F -f lavfi -i "color=c=black@0.5:s=4x4:r=10:d=1,format=rgba" -c:v png ha.mov
echo -n "   blend keeps 10 frames and their pts: "; ffmpeg -hide_banner -copyts -i ha.mov -vf "$B,showinfo" -f null - 2>&1 | grep -o "pts_time:[0-9.]*" | tr '\n' ' '; echo

echo "== (d) mixed stream, vlmkit's own command"
$F -f lavfi -i color=c=gray:s=64x48:r=25:d=1 -c:v libx264 -qp 0 -pix_fmt yuv444p -bf 0 a.ts
$F -f lavfi -i "color=c=black:s=64x48:r=50:d=1,geq=lum='16+219*mod(N\,2)':cb=128:cr=128,tinterlace=mode=interleave_top,setfield=tff" -c:v libx264 -qp 0 -pix_fmt yuv444p -bf 0 -flags +ilme+ildct -x264opts tff=1 -output_ts_offset 1 b.ts
cat a.ts b.ts > m.ts; $F -i m.ts -c copy m.mkv
echo -n "   ffprobe frames: "; ffprobe -v error -select_streams v:0 -show_entries frame=best_effort_timestamp -of csv=p=0 m.mkv | tr '\n' ' '; echo
mkdir -p fi fr
X="scale=in_color_matrix=bt601:in_range=tv:$SW,format=rgb24,setparams=color_primaries=unknown:color_trc=unknown:colorspace=unknown,sidedata=mode=delete:type=ICC_PROFILE"
run() {
  rm -f fi/* fr/*
  ffmpeg -hide_banner -nostdin -nostats -loglevel level+info -sws_flags accurate_rnd+full_chroma_int -copyts "$@" -i m.mkv \
    -map 0:0 -an -sn -dn -fps_mode passthrough -vf "select='between(n,25,49)',separatefields,scale=w=iw:h=ih*2:flags=neighbor,setsar=r=sar/2:max=10000,$X,showinfo@fields=checksum=0" -c:v png -f image2 fi/%06d.png \
    -map 0:0 -an -sn -dn -fps_mode passthrough -vf "select='between(n,0,24)',$X,showinfo@frames=checksum=0" -c:v png -f image2 fr/%06d.png 2>&1 \
    | grep -E "showinfo@frames.*n:" | grep -o "n: *[0-9]* pts: *[0-9]*" | tail -3 | tr '\n' ';'
  echo " fields=$(ls fi | wc -l) frames=$(ls fr | wc -l)"
}
echo -n "   with -reinit_filter 0: "; run -reinit_filter 0
echo -n "   without:              "; run
echo -n "   frames graph alone:   "; rm -f fr/*; ffmpeg -hide_banner -loglevel error -copyts -reinit_filter 0 -i m.mkv -map 0:0 -fps_mode passthrough -vf "select='between(n,0,24)',$X" -c:v png -f image2 fr/%06d.png; echo "frames=$(ls fr | wc -l)"
echo -n "   select n=24 alone:   "; rm -f fr/*; ffmpeg -hide_banner -loglevel error -copyts -reinit_filter 0 -i m.mkv -map 0:0 -fps_mode passthrough -vf "select='eq(n,24)',$X,showinfo" -c:v png -f image2 fr/%06d.png; echo "frames=$(ls fr | wc -l)"
echo "== done"
