#!/usr/bin/env bash
# TEMPORARY (ffmpeg 8 investigation for the video tests); removed before merge.
set -u
D=$(mktemp -d)
cd "$D"
F="ffmpeg -hide_banner -loglevel error -y"
tags() { ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,pix_fmt,color_range,color_space,color_transfer,color_primaries,field_order -of compact "$1"; }
centre() { # file, vf, pixfmt bytes-per-px -> centre pixel of each frame (first 6)
  ffmpeg -hide_banner -loglevel error -i "$1" ${3:-} -vf "$2" -f rawvideo -pix_fmt rgb24 - | od -An -tu1 -v -w"$4" | awk -v off="$5" '{print $(off+1)}' | head -6 | tr '\n' ' '; echo
}
echo "== version"; ffmpeg -hide_banner -version | head -1

echo "== red709 tags (expect bt709 x4)"
$F -f lavfi -i color=c=red:s=64x48:d=0.2:r=10 -vf scale=out_color_matrix=bt709:out_range=tv,format=yuv420p -c:v libx264 -crf 10 -colorspace bt709 -color_range tv -color_primaries bt709 -color_trc bt709 red709.mp4
tags red709.mp4
$F -f lavfi -i color=c=red:s=64x48:d=0.2:r=10 -vf scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=colorspace=bt709:range=tv:color_primaries=bt709:color_trc=bt709 -c:v libx264 -crf 10 red709b.mp4
echo "-- with setparams:"; tags red709b.mp4

echo "== hdr tags (expect smpte2084)"
$F -f lavfi -i color=c=gray:s=64x48:d=0.1 -c:v libx264 -color_trc smpte2084 -color_primaries bt2020 -colorspace bt2020nc hdr.mp4; tags hdr.mp4
$F -f lavfi -i color=c=gray:s=64x48:d=0.1,setparams=color_trc=smpte2084:color_primaries=bt2020:colorspace=bt2020nc -c:v libx264 hdrb.mp4; echo "-- with setparams:"; tags hdrb.mp4

echo "== vp9 blend untagged (expect no colorspace)"
$F -f lavfi -i color=c=0x00d700:s=32x32:r=10:d=0.4 -f lavfi -i color=c=0x00ff00:s=32x32:r=10:d=0.4 -filter_complex "[0][1]blend=all_expr='if(lt(mod(N\,2)\,1)\,B\,A)',scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" -c:v libvpx-vp9 -lossless 1 vp9.webm; tags vp9.webm
$F -f lavfi -i color=c=0x00d700:s=32x32:r=10:d=0.4 -f lavfi -i color=c=0x00ff00:s=32x32:r=10:d=0.4 -filter_complex "[0][1]blend=all_expr='if(lt(mod(N\,2)\,1)\,B\,A)',scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=colorspace=unknown" -c:v libvpx-vp9 -lossless 1 vp9b.webm; echo "-- with setparams=colorspace=unknown:"; tags vp9b.webm

echo "== tt tag over progressive (expect field_order tt)"
$F -f lavfi -i "color=c=black:s=64x48:r=25:d=0.4,geq=lum='16+219*mod(Y\,2)':cb=128:cr=128" -c:v libx264 -qp 0 -pix_fmt yuv444p -field_order tt st.mkv; tags st.mkv
$F -f lavfi -i "color=c=black:s=64x48:r=25:d=0.4,geq=lum='16+219*mod(Y\,2)':cb=128:cr=128" -c:v libx264 -qp 0 -pix_fmt yuv444p st0.mkv; $F -i st0.mkv -c copy -field_order tt st2.mkv; echo "-- remux -c copy -field_order tt:"; tags st2.mkv
ffprobe -v error -select_streams v:0 -show_entries frame=interlaced_frame,top_field_first -of csv st.mkv | sort | uniq -c

echo "== utvideo ramp tt (expect tt)"
$F -f lavfi -i "color=c=black:s=64x48:r=50:d=0.4,format=yuv444p,geq=lum='16+10*N':cb=128:cr=128,tinterlace=mode=interleave_top" -c:v utvideo -field_order tt ramp.mkv; tags ramp.mkv
ffprobe -v error -select_streams v:0 -show_entries frame=interlaced_frame,top_field_first -of csv ramp.mkv | sort | uniq -c

echo "== mono x265 gray tv (expect tv)"
$F -f lavfi -i "color=c=black:s=16x16:r=10:d=0.2,format=gray,geq=lum='if(mod(N\,2)\,235\,16)'" -c:v libx265 -pix_fmt gray -x265-params lossless=1:log-level=error -color_range tv mono.mp4; tags mono.mp4
echo "-- raw luma of frames (expect 16 235):"; ffmpeg -hide_banner -loglevel error -i mono.mp4 -f rawvideo -pix_fmt gray - | od -An -tu1 -v -w256 | awk '{print $137}' | tr '\n' ' '; echo
$F -f lavfi -i "color=c=black:s=16x16:r=10:d=0.2,format=gray,geq=lum='if(mod(N\,2)\,235\,16)',setparams=range=tv" -c:v libx265 -pix_fmt gray -x265-params lossless=1:log-level=error mono2.mp4; echo "-- with setparams=range=tv:"; tags mono2.mp4
ffmpeg -hide_banner -loglevel error -i mono2.mp4 -f rawvideo -pix_fmt gray - | od -An -tu1 -v -w256 | awk '{print $137}' | tr '\n' ' '; echo

echo "== grey pc 150/172, decode variants to rgb (pc: expect 150 172; told tv: expect 156 182)"
$F -f lavfi -i "color=c=black:s=16x16:r=10:d=0.2,format=gray,geq=lum='if(mod(N\,2)\,172\,150)'" -c:v libx265 -pix_fmt gray -x265-params lossless=1:log-level=error -color_range pc gpc.mp4; tags gpc.mp4
echo "-- raw luma:"; ffmpeg -hide_banner -loglevel error -i gpc.mp4 -f rawvideo -pix_fmt gray - | od -An -tu1 -v -w256 | awk '{print $137}' | tr '\n' ' '; echo
for chain in \
  "scale=in_range=tv:out_range=tv,format=yuv444p,scale=in_color_matrix=bt601:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24" \
  "setparams=range=tv,scale=in_range=tv:out_range=tv,format=yuv444p,scale=in_color_matrix=bt601:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24" \
  "setparams=range=tv,format=yuv444p,scale=in_color_matrix=bt601:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24" \
  "scale=in_range=pc:out_range=pc,format=yuv444p,scale=in_color_matrix=bt601:in_range=pc:flags=accurate_rnd+full_chroma_int,format=rgb24"; do
  echo "   $chain"; echo -n "   -> "; centre gpc.mp4 "$chain" "" 768 408
done

echo "== GIF without GCE: frames"
printf 'R0lGODlhAgACAIAAAAAAAP///yH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAgACAAACBARBEAUAIfkEAAoAAAAsAAAAAAIAAgAAAgQMwzAFADs=' | base64 -d > g.gif
python3 - <<'EOF'
b=open('g.gif','rb').read(); out=b''; at=0
while True:
    i=b.find(bytes([0x21,0xf9,0x04]),at)
    if i<0: break
    out+=b[at:i]; at=i+8
out+=b[at:]; open('nogce.gif','wb').write(out)
EOF
echo -n "with GCE: "; ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 g.gif
echo -n "no GCE: "; ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 nogce.gif
ffprobe -v error -select_streams v:0 -show_entries frame=best_effort_timestamp_time,pkt_pos,key_frame -of csv nogce.gif
ffmpeg -hide_banner -loglevel error -i nogce.gif -f rawvideo -pix_fmt rgb24 - | od -An -tu1 -v -w12

echo "== mixed ts (24 vs 25)"
$F -f lavfi -i "color=c=black:s=64x48:r=25:d=1,geq=lum='16+219*mod(N\,2)':cb=128:cr=128" -c:v libx264 -qp 0 -pix_fmt yuv444p -bf 0 a.ts
$F -f lavfi -i "color=c=black:s=64x48:r=50:d=1,geq=lum='16+219*mod(N\,2)':cb=128:cr=128,tinterlace=mode=interleave_top,setfield=tff" -c:v libx264 -qp 0 -pix_fmt yuv444p -bf 0 -flags +ilme+ildct -x264opts tff=1 -output_ts_offset 1 b.ts
cat a.ts b.ts > m.ts; $F -i m.ts -c copy m.mkv
echo -n "ffprobe frames: "; ffprobe -v error -select_streams v:0 -show_entries frame=best_effort_timestamp_time -of csv=p=0 m.mkv | wc -l
echo -n "ffmpeg frames (passthrough): "; ffmpeg -hide_banner -loglevel error -copyts -i m.mkv -map 0:0 -fps_mode passthrough -f null - -vf showinfo 2>&1 | grep -c "n:" ; ffmpeg -hide_banner -copyts -reinit_filter 0 -i m.mkv -map 0:0 -fps_mode passthrough -vf showinfo -f null - 2>&1 | grep -o "n: *[0-9]* pts: *[0-9]*" | head -30 | tr '\n' ';'; echo
ffprobe -v error -select_streams v:0 -show_entries frame=best_effort_timestamp,pkt_pts,pts,interlaced_frame -of csv=p=0 m.mkv | head -30 | tr '\n' ';'; echo

echo "== rotation + reinit_filter order"
$F -f lavfi -i "color=c=black:s=64x48:r=50:d=0.4,geq=lum='16+219*mod(N\,2)':cb=128:cr=128,tinterlace=mode=interleave_top,setfield=tff" -c:v libx264 -qp 0 -pix_fmt yuv444p -flags +ilme+ildct -x264opts tff=1 s.mp4
$F -display_rotation 90 -i s.mp4 -c copy s90.mp4
for pre in "-reinit_filter 0 -autorotate 0" "-autorotate 0 -reinit_filter 0" "-noautorotate -reinit_filter 0" "-reinit_filter 0" "-autorotate 0"; do
  echo -n "   [$pre] -> "; ffmpeg -hide_banner -loglevel error -copyts $pre -i s90.mp4 -map 0:0 -vf transpose=1 -f null - 2>&1 | head -2 | tr '\n' ' '; echo "exit=$?"
done
echo "== done"
