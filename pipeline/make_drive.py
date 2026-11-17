"""Make DRIVING videos for gen_animation.py, with no real person: the rigged MakeHuman woman from
nine.blend (CC0 assets, our own build) performs a scripted motion, rendered as a plain full-body clip.
Only her motion is used by the animation model, so a fast Workbench render is enough.

Run: blender --background D:/tmp/nine-avatar/nine.blend --python make_drive.py -- <ABSOLUTE out_dir> <motion> [frames] [fps]
motions: wave | talk | walk | axes (a test sheet: which local axis bends which bone)
"""
import bpy, math, os, sys
from mathutils import Euler, Vector

args = sys.argv[sys.argv.index("--") + 1:]
OUT = os.path.abspath(args[0]); MOTION = args[1]
FRAMES = int(args[2]) if len(args) > 2 else 80; FPS = int(args[3]) if len(args) > 3 else 16
os.makedirs(OUT, exist_ok=True)
scene = bpy.context.scene
rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
PB = rig.pose.bones
def bone(n): return PB["mixamorig:" + n]
for b in PB: b.rotation_mode = "XYZ"

# ---------------------------------------------------------------- render setup: plain, even, full body
scene.render.engine = "BLENDER_WORKBENCH"
sh = scene.display.shading
sh.light = "STUDIO"; sh.color_type = "TEXTURE"; sh.show_shadows = True; sh.show_cavity = True
scene.render.film_transparent = False
world = scene.world or bpy.data.worlds.new("w"); scene.world = world; world.color = (0.78, 0.8, 0.83)
scene.render.resolution_x, scene.render.resolution_y = 480, 832
scene.render.fps = FPS; scene.frame_start = 1; scene.frame_end = FRAMES
cam = scene.camera
cam.data.lens = 40
cam.location = (0.0, -3.1, 0.92); cam.rotation_euler = (math.radians(90), 0, 0)

# ---------------------------------------------------------------- posing helpers
def key(frame, pose, hips=None):
    """pose: {bone: (x, y, z) degrees}; every listed bone is keyed, the rest stay as they are"""
    for n, (x, y, z) in pose.items():
        b = bone(n); b.rotation_euler = Euler([math.radians(v) for v in (x, y, z)])
        b.keyframe_insert("rotation_euler", frame=frame)
    if hips is not None:
        bone("Hips").location = Vector(hips); bone("Hips").keyframe_insert("location", frame=frame)
def mix(a, b, t):
    return {k: tuple(a.get(k, (0, 0, 0))[i] * (1 - t) + b.get(k, (0, 0, 0))[i] * t for i in range(3)) for k in set(a) | set(b)}

# Axes in this rig (from the "axes" sheet): the rest pose is an A-pose; the upper arm lifts/lowers on its
# local Y (mirrored left/right) and swings forward on X; the forearm bends forward on X and sideways on Z;
# the thigh swings on X and the knee bends on X.
ARM_DOWN = float(os.environ.get("NINE_ARM_DOWN", "55"))
def arm(side, down=ARM_DOWN, fwd=0.0, elbow=4.0, side_bend=0.0, twist=0.0):
    s = 1 if side == "Left" else -1               # Y and Z are mirrored between the two sides
    return {f"{side}Arm": (fwd, s * down, s * twist), f"{side}ForeArm": (elbow, 0, s * side_bend)}
RELAXED = {**arm("Left"), **arm("Right"), "Spine": (0, 0, 0), "Neck": (0, 0, 0), "Head": (0, 0, 0)}

if MOTION == "axes":
    # one still per (bone, axis, +60 deg): shows which axis does what in this rig
    tests = [(b, ax) for b in ("RightArm", "RightForeArm", "LeftUpLeg", "LeftLeg") for ax in "XYZ"]
    for k, (bn, ax) in enumerate(tests):
        for b in PB: b.rotation_euler = Euler((0, 0, 0))
        r = [0, 0, 0]; r["XYZ".index(ax)] = 60
        bone(bn).rotation_euler = Euler([math.radians(v) for v in r])
        scene.render.filepath = os.path.join(OUT, f"axes_{k:02d}_{bn}_{ax}.png")
        bpy.ops.render.render(write_still=True)
    print("[drive] axes sheet written", flush=True); sys.exit(0)

T = FRAMES
if MOTION == "wave":
    # a friendly wave: raise the right arm, forearm up, wave from the elbow three times, lower it again
    up = {**RELAXED, **arm("Right", down=-50, fwd=10, elbow=5, side_bend=85), "Head": (4, 0, -4), "Spine1": (0, 0, 3)}
    key(1, RELAXED); key(int(T * .18), up)
    for k in range(6):
        f = int(T * .18 + (T * .55) * (k + 1) / 6)
        key(f, {**up, **arm("Right", down=-50, fwd=10, elbow=5, side_bend=85 + (22 if k % 2 == 0 else -18)), "RightHand": (0, 0, 10 if k % 2 else -10)})
    key(int(T * .85), up); key(T, RELAXED)
elif MOTION == "talk":
    # explaining: both forearms up in front, hands opening and turning, small nods and a little sway
    base = {**arm("Left", down=50, fwd=30, elbow=100), **arm("Right", down=50, fwd=30, elbow=100)}
    key(1, RELAXED)
    for k in range(9):
        f = int(1 + (T - 1) * (k + 1) / 10)
        w = math.sin(k * 1.7)
        key(f, {**RELAXED, **base,
                "LeftForeArm": (100 + 15 * w, 0, -12 * w), "RightForeArm": (100 - 15 * w, 0, 12 * w),
                "LeftHand": (0, 25 * w, 0), "RightHand": (0, -25 * w, 0),
                "Head": (6 * math.sin(k * 2.3), 0, 4 * w), "Spine1": (0, 3 * w, 0), "Neck": (3 * math.sin(k * 1.1), 0, 0)})
    key(T, RELAXED)
elif MOTION == "walk":
    # two steps forward and back to standing: legs, knees, counter-swinging arms, hip bob, forward travel
    hips0 = tuple(bone("Hips").location)
    steps = 4; per = T // (steps + 1)
    for k in range(steps * 2 + 1):
        f = 1 + k * per // 2
        ph = math.sin(k * math.pi / 2)            # -1..1 across a step
        c = math.cos(k * math.pi / 2)
        swing = 28 * ph * float(os.environ.get("NINE_LEG_SIGN", "1"))
        key(f, {**RELAXED,
                "LeftUpLeg": (-swing, 0, 0), "RightUpLeg": (swing, 0, 0),
                "LeftLeg": (max(0, 35 * c), 0, 0), "RightLeg": (max(0, -35 * c), 0, 0),
                **arm("Left", fwd=18 * ph, elbow=15), **arm("Right", fwd=-18 * ph, elbow=15),
                "Spine1": (0, 4 * ph, 0)},
            hips=(hips0[0], hips0[1] + 0.012 * abs(c), hips0[2] - 0.12 * k / (steps * 2)))
    key(T, RELAXED, hips=(hips0[0], hips0[1], hips0[2] - 0.12))
else:
    raise SystemExit(f"unknown motion {MOTION}")

if os.environ.get("NINE_STILLS"):
    for f in (1, int(T * .3), int(T * .5), int(T * .7)):
        scene.frame_set(f); scene.render.filepath = os.path.join(OUT, f"still_{MOTION}_{f:03d}.png")
        bpy.ops.render.render(write_still=True)
    print("[drive] stills written", flush=True); sys.exit(0)
# Blender 5.3 has no FFmpeg image format: render PNG frames; frames_to_mp4() below (or any tool) makes the video
scene.render.image_settings.file_format = "PNG"
fdir = os.path.join(OUT, f"frames_{MOTION}"); os.makedirs(fdir, exist_ok=True)
scene.render.filepath = os.path.join(fdir, "f_")
bpy.ops.render.render(animation=True)
print("[drive] rendered", fdir, flush=True)
