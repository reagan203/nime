"""Nine's display head, v3: a CURVED display on a heavy mechanical neck that is FUSED into flesh.

What changed from v2 (kept as display_head.v2.py):
  * Curved head: every head part is bent around a vertical axis in front of the screen (like a
    curved monitor), the screen sits behind a real 3 mm glass cover (refraction + reflections),
    and the screen panel emits a soft "on" glow so the inner bezel lip catches light.
  * Flesh connection: a short SKIN STUMP (subsurface-scattering skin, colour matched to the photo)
    is rendered under the mount ring. The ring's gasket lip sinks into it, the skin bulges around the
    lip, there is a contact crease, and the blue light ring shines down into the skin (real SSS glow).
    The stump fades to transparent toward the bottom so it melts into the photographed neck.
  * Heavier neck: thicker mount ring with two bolt rows, armoured shroud plates around the spine,
    four pistons, servo housings at the gimbal, a rear cable loom, and two hydraulic hoses that run
    down and out to where the shirt collar is (export_web.py puts the collar back over them, so
    they disappear into the suit).
  * Writes a screen GRID (not just 4 corners) so the web face can follow the curve.

Run: blender --background --factory-startup --python display_head.py -- <ABSOLUTE out_dir> [yaw_deg] [samples]
Env: NINE_SKIN="r,g,b" (linear) to match the photo's neck; default measured from body_7104 (0.267,0.117,0.060)
"""
import bpy, bmesh, math, os, sys, json
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

args = sys.argv[sys.argv.index("--") + 1:]
OUT = os.path.abspath(args[0]); YAW = float(args[1]) if len(args) > 1 else -9.0; SAMPLES = int(args[2]) if len(args) > 2 else 256
SKIN = tuple(float(v) for v in os.environ.get("NINE_SKIN", "0.267,0.117,0.060").split(","))
os.makedirs(OUT, exist_ok=True)
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
scene = bpy.context.scene
def log(*a): print("[head]", *a, flush=True)

# ================================================================== materials
def principled(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    return m, m.node_tree, m.node_tree.nodes["Principled BSDF"]
def noise_into(nt, socket, scale, lo, hi, detail=6.0):
    tc = nt.nodes.new("ShaderNodeTexCoord"); nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale; nz.inputs["Detail"].default_value = detail
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["To Min"].default_value = lo; mr.inputs["To Max"].default_value = hi
    nt.links.new(nz.outputs["Fac"], mr.inputs["Value"]); nt.links.new(mr.outputs["Result"], socket)
def bump(nt, b, scale, strength, stretch=None):
    tc = nt.nodes.new("ShaderNodeTexCoord"); nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale; nz.inputs["Detail"].default_value = 8.0
    src = tc.outputs["Object"]
    if stretch:
        mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = stretch
        nt.links.new(src, mp.inputs["Vector"]); src = mp.outputs["Vector"]
    nt.links.new(src, nz.inputs["Vector"])
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = strength
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return bp

alu, nt, b = principled("graphite_aluminium")
b.inputs["Base Color"].default_value = (0.055, 0.06, 0.068, 1); b.inputs["Metallic"].default_value = 1.0
noise_into(nt, b.inputs["Roughness"], 260, 0.26, 0.4)
if "Anisotropic" in b.inputs: b.inputs["Anisotropic"].default_value = 0.55
bump(nt, b, 900, 0.025, stretch=(1, 1, 60))

dark_alu, nt, b = principled("dark_anodised")                      # heavier neck parts: darker, a bit rougher
b.inputs["Base Color"].default_value = (0.03, 0.032, 0.036, 1); b.inputs["Metallic"].default_value = 1.0
noise_into(nt, b.inputs["Roughness"], 300, 0.32, 0.48); bump(nt, b, 700, 0.03)

bezel, nt, b = principled("satin_bezel")
b.inputs["Base Color"].default_value = (0.018, 0.019, 0.022, 1)
noise_into(nt, b.inputs["Roughness"], 400, 0.42, 0.55); bump(nt, b, 1500, 0.04)

# the screen panel underneath the glass: near-black with a soft "on" glow (lights the inner bezel)
panel, nt, b = principled("screen_panel")
b.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1); b.inputs["Roughness"].default_value = 0.35
tc = nt.nodes.new("ShaderNodeTexCoord"); vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 220
nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
ramp = nt.nodes.new("ShaderNodeValToRGB"); ramp.color_ramp.elements[0].position = 0.0; ramp.color_ramp.elements[1].position = 0.06
ramp.color_ramp.elements[0].color = (1, 1, 1, 1); ramp.color_ramp.elements[1].color = (0, 0, 0, 1)
nt.links.new(vor.outputs["Distance"], ramp.inputs["Fac"])
# radial vignette: brighter in the middle, like a backlit panel
grad = nt.nodes.new("ShaderNodeTexGradient"); grad.gradient_type = "SPHERICAL"
mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (6.0, 1.0, 8.0)
nt.links.new(tc.outputs["Object"], mp.inputs["Vector"]); nt.links.new(mp.outputs["Vector"], grad.inputs["Vector"])
glow = nt.nodes.new("ShaderNodeMix"); glow.data_type = "RGBA"; glow.blend_type = "MIX"
glow.inputs[6].default_value = (0.006, 0.016, 0.03, 1); glow.inputs[7].default_value = (0.03, 0.09, 0.16, 1)
nt.links.new(grad.outputs["Fac"], glow.inputs[0])
add = nt.nodes.new("ShaderNodeMix"); add.data_type = "RGBA"; add.blend_type = "ADD"; add.inputs[0].default_value = 0.5
nt.links.new(glow.outputs[2], add.inputs[6]); nt.links.new(ramp.outputs["Color"], add.inputs[7])
nt.links.new(add.outputs[2], b.inputs["Emission Color"]); b.inputs["Emission Strength"].default_value = 1.6

# the 3 mm glass cover in front of it: see-through with Fresnel reflections. Refraction through the slab
# picked up the studio lights as a big bright patch, so the glass is a transparent + glossy mix instead.
glass = bpy.data.materials.new("cover_glass"); glass.use_nodes = True
nt = glass.node_tree; nt.nodes.remove(nt.nodes["Principled BSDF"])
lw = nt.nodes.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.12
tr = nt.nodes.new("ShaderNodeBsdfTransparent")
gl = nt.nodes.new("ShaderNodeBsdfGlossy"); gl.inputs["Roughness"].default_value = 0.02
mx = nt.nodes.new("ShaderNodeMixShader")
nt.links.new(lw.outputs["Fresnel"], mx.inputs["Fac"]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(gl.outputs[0], mx.inputs[2])
nt.links.new(mx.outputs[0], nt.nodes["Material Output"].inputs["Surface"])

led, nt, b = principled("brand_led")
b.inputs["Base Color"].default_value = (0.05, 0.45, 0.85, 1)
b.inputs["Emission Color"].default_value = (0.1, 0.55, 1.0, 1); b.inputs["Emission Strength"].default_value = 6.0

led_soft, nt, b = principled("brand_led_soft")                     # the ring that shines onto the skin
b.inputs["Base Color"].default_value = (0.05, 0.45, 0.85, 1)
b.inputs["Emission Color"].default_value = (0.12, 0.55, 1.0, 1); b.inputs["Emission Strength"].default_value = 5.0

steel, nt, b = principled("brushed_steel")
b.inputs["Base Color"].default_value = (0.62, 0.64, 0.67, 1); b.inputs["Metallic"].default_value = 1.0
noise_into(nt, b.inputs["Roughness"], 300, 0.22, 0.34)
if "Anisotropic" in b.inputs: b.inputs["Anisotropic"].default_value = 0.7
bump(nt, b, 800, 0.02, stretch=(1, 60, 1))

chrome, nt, b = principled("chrome_rod")
b.inputs["Base Color"].default_value = (0.9, 0.91, 0.93, 1); b.inputs["Metallic"].default_value = 1.0; b.inputs["Roughness"].default_value = 0.06

rubber, nt, b = principled("braided_cable")
b.inputs["Base Color"].default_value = (0.02, 0.022, 0.026, 1); b.inputs["Roughness"].default_value = 0.6
bump(nt, b, 2200, 0.25, stretch=(1, 1, 8))

hose, nt, b = principled("hydraulic_hose")                          # thick rubber hose, slightly glossy
b.inputs["Base Color"].default_value = (0.012, 0.013, 0.015, 1); b.inputs["Roughness"].default_value = 0.38
bump(nt, b, 1800, 0.12, stretch=(1, 1, 3))

gasket, nt, b = principled("rubber_gasket")
b.inputs["Base Color"].default_value = (0.012, 0.012, 0.014, 1); b.inputs["Roughness"].default_value = 0.75

# ---- skin: subsurface scattering, pores, tone variation and faint veins; fades out toward the bottom ----
skin_m = bpy.data.materials.new("neck_skin"); skin_m.use_nodes = True
nt = skin_m.node_tree; b = nt.nodes["Principled BSDF"]
b.inputs["Roughness"].default_value = 0.44
if "Subsurface Weight" in b.inputs:
    b.inputs["Subsurface Weight"].default_value = 0.22
    b.inputs["Subsurface Radius"].default_value = (1.0, 0.35, 0.18)
    b.inputs["Subsurface Scale"].default_value = 0.01
if "Specular IOR Level" in b.inputs: b.inputs["Specular IOR Level"].default_value = 0.42
tc = nt.nodes.new("ShaderNodeTexCoord")
tone = nt.nodes.new("ShaderNodeTexNoise"); tone.inputs["Scale"].default_value = 40; tone.inputs["Detail"].default_value = 3
nt.links.new(tc.outputs["Object"], tone.inputs["Vector"])
base = nt.nodes.new("ShaderNodeMix"); base.data_type = "RGBA"
base.inputs[6].default_value = (SKIN[0] * 0.92, SKIN[1] * 0.9, SKIN[2] * 0.92, 1)
base.inputs[7].default_value = (SKIN[0] * 1.08, SKIN[1] * 1.04, SKIN[2] * 1.0, 1)
nt.links.new(tone.outputs["Fac"], base.inputs[0])
# faint veins: a distorted vertical wave, thresholded thin, tinted cool blue-green
vmap = nt.nodes.new("ShaderNodeMapping"); vmap.inputs["Scale"].default_value = (1.0, 1.0, 0.35)
nt.links.new(tc.outputs["Object"], vmap.inputs["Vector"])
wave = nt.nodes.new("ShaderNodeTexWave"); wave.wave_type = "BANDS"; wave.bands_direction = "X"
wave.inputs["Scale"].default_value = 9.0; wave.inputs["Distortion"].default_value = 7.0; wave.inputs["Detail"].default_value = 4.0
nt.links.new(vmap.outputs["Vector"], wave.inputs["Vector"])
vr = nt.nodes.new("ShaderNodeValToRGB"); vr.color_ramp.elements[0].position = 0.9; vr.color_ramp.elements[1].position = 1.0
vr.color_ramp.elements[0].color = (0, 0, 0, 1); vr.color_ramp.elements[1].color = (1, 1, 1, 1)
nt.links.new(wave.outputs["Fac"], vr.inputs["Fac"])
veins = nt.nodes.new("ShaderNodeMix"); veins.data_type = "RGBA"
veins.inputs[7].default_value = (SKIN[0] * 0.55, SKIN[1] * 0.75, SKIN[2] * 1.35, 1)
vfac = nt.nodes.new("ShaderNodeMath"); vfac.operation = "MULTIPLY"; vfac.inputs[1].default_value = 0.22
nt.links.new(vr.outputs["Color"], vfac.inputs[0]); nt.links.new(vfac.outputs[0], veins.inputs[0])
nt.links.new(base.outputs[2], veins.inputs[6]); nt.links.new(veins.outputs[2], b.inputs["Base Color"])
# pores
pz = nt.nodes.new("ShaderNodeTexVoronoi"); pz.inputs["Scale"].default_value = 1400
nt.links.new(tc.outputs["Object"], pz.inputs["Vector"])
pb = nt.nodes.new("ShaderNodeBump"); pb.inputs["Strength"].default_value = 0.08; pb.inputs["Distance"].default_value = 0.0004
nt.links.new(pz.outputs["Distance"], pb.inputs["Height"]); nt.links.new(pb.outputs["Normal"], b.inputs["Normal"])
# fade to transparent below the contact zone so the stump melts into the photographed neck
sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
fade = nt.nodes.new("ShaderNodeMapRange")
nt.links.new(sep.outputs["Z"], fade.inputs["Value"])
transp = nt.nodes.new("ShaderNodeBsdfTransparent"); mixs = nt.nodes.new("ShaderNodeMixShader")
out = nt.nodes["Material Output"]
nt.links.new(fade.outputs["Result"], mixs.inputs["Fac"])
nt.links.new(transp.outputs[0], mixs.inputs[1]); nt.links.new(b.outputs[0], mixs.inputs[2])
nt.links.new(mixs.outputs[0], out.inputs["Surface"])
SKIN_FADE = fade                                                  # From Min/Max set once the stump exists

# ================================================================== helpers
parts = []
def finish(o, mat, smooth=True):
    o.data.materials.append(mat)
    if smooth and o.type == "MESH":
        for poly in o.data.polygons: poly.use_smooth = True
    parts.append(o); return o
def slice_x(o, w, cuts):
    """add vertical edge loops so the part can bend smoothly"""
    bm = bmesh.new(); bm.from_mesh(o.data)
    for i in range(1, cuts):
        x = -w / 2 + w * i / cuts
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(x, 0, 0), plane_no=(1, 0, 0))
    bm.to_mesh(o.data); bm.free()
def rounded_box(name, w, d, h, bevel, segs, mat, loc=(0, 0, 0), cuts=0, smooth=True):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = (w, d, h)
    bpy.ops.object.transform_apply(scale=True)
    m = o.modifiers.new("bevel", "BEVEL"); m.width = bevel; m.segments = segs; m.limit_method = "NONE"
    bpy.ops.object.modifier_apply(modifier="bevel")
    if cuts: slice_x(o, w, cuts)
    if smooth: o.modifiers.new("wn", "WEIGHTED_NORMAL")
    return finish(o, mat, smooth)
def cyl(name, r, depth, loc, mat, rot=(0, 0, 0), verts=64, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if bevel:
        bm_ = o.modifiers.new("bevel", "BEVEL"); bm_.width = bevel; bm_.segments = 3; bm_.limit_method = "ANGLE"
    return finish(o, mat)
def between(name, a, b_, r, mat, verts=32):
    a, b_ = Vector(a), Vector(b_); d = b_ - a
    o = cyl(name, r, d.length, (a + b_) / 2, mat, verts=verts)
    o.rotation_mode = "QUATERNION"; o.rotation_quaternion = d.to_track_quat("Z", "Y"); return o
def sphere(name, r, loc, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=48, ring_count=24)
    o = bpy.context.active_object; o.name = name; return finish(o, mat)
def torus(name, R, r, loc, mat):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, major_segments=96, minor_segments=16)
    o = bpy.context.active_object; o.name = name; return finish(o, mat)
def tube(name, pts, radius, mat, res=6):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = radius; cu.bevel_resolution = res
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(len(pts) - 1)
    for bp, co in zip(sp.bezier_points, pts):
        bp.co = co; bp.handle_left_type = bp.handle_right_type = "AUTO"
    ob = bpy.data.objects.new(name, cu); ob.data.materials.append(mat); scene.collection.objects.link(ob); parts.append(ob)
    return ob

# ================================================================== the curved head
W, H, D = 0.34, 0.255, 0.16
FRONT = -D / 2                       # front face plane (y)
R_CURVE = 0.70                       # radius of the curve: the edges come ~2 cm toward the viewer
def bend_co(co):
    """bend around a vertical axis R_CURVE in front of the screen (concave toward the viewer)"""
    cy = FRONT - R_CURVE
    d = co.y - cy; th = co.x / R_CURVE
    return Vector((d * math.sin(th), cy + d * math.cos(th), co.z))
def bend(o):
    """bend in world space (all head parts are still unparented, at world = object transform)"""
    mw = o.matrix_world.copy(); inv = mw.inverted()
    if o.type == "MESH":
        for v in o.data.vertices: v.co = inv @ bend_co(mw @ v.co)
        o.data.update()
    elif o.type == "CURVE":
        for sp in o.data.splines:
            for bp in sp.bezier_points:
                bp.handle_left_type = bp.handle_right_type = "FREE"
                bp.co, bp.handle_left, bp.handle_right = (inv @ bend_co(mw @ bp.co), inv @ bend_co(mw @ bp.handle_left), inv @ bend_co(mw @ bp.handle_right))

head_parts_start = len(parts)
rounded_box("shell", W, D, H, 0.028, 8, alu, cuts=24)
rounded_box("rear_housing", W * 0.78, D * 0.45, H * 0.78, 0.035, 8, alu, (0, D * 0.62, 0), cuts=16)
rounded_box("bezel", W * 0.955, 0.012, H * 0.94, 0.02, 6, bezel, (0, FRONT - 0.004, 0), cuts=24)

sw, sh = W * 0.86, H * 0.78
SCREEN_Y = FRONT - 0.0105
bpy.ops.mesh.primitive_grid_add(x_subdivisions=48, y_subdivisions=32, size=1, location=(0, SCREEN_Y, 0.006), rotation=(math.radians(90), 0, 0))
screen = bpy.context.active_object; screen.name = "screen_panel"; screen.scale = (sw, sh, 1)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
finish(screen, panel)
GRID_LOCAL = [v.co.copy() for v in screen.data.vertices]          # flat positions (object space), before bending

# inner bezel lip around the panel (catches the panel's glow)
lip_d, lip_t = 0.006, 0.006
for nm, (x, z, w_, h_) in {"lip_top": (0, 0.006 + sh / 2 + lip_t / 2, sw + 2 * lip_t, lip_t), "lip_bottom": (0, 0.006 - sh / 2 - lip_t / 2, sw + 2 * lip_t, lip_t),
                          "lip_left": (-sw / 2 - lip_t / 2, 0.006, lip_t, sh), "lip_right": (sw / 2 + lip_t / 2, 0.006, lip_t, sh)}.items():
    rounded_box(nm, w_, lip_d, h_, 0.0015, 2, bezel, (x, SCREEN_Y - lip_d / 2 + 0.001, z), cuts=24 if w_ > 0.1 else 0, smooth=False)

# 3 mm cover glass, slightly proud of the lip
bpy.ops.mesh.primitive_grid_add(x_subdivisions=48, y_subdivisions=8, size=1, location=(0, SCREEN_Y - lip_d - 0.0005, 0.006), rotation=(math.radians(90), 0, 0))
cover = bpy.context.active_object; cover.name = "cover_glass"; cover.scale = (sw + 2 * lip_t + 0.004, sh + 2 * lip_t + 0.004, 1)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
sol = cover.modifiers.new("thick", "SOLIDIFY"); sol.thickness = 0.003; sol.offset = 0
bpy.ops.object.modifier_apply(modifier="thick")
finish(cover, glass)

rounded_box("light_strip", sw * 0.5, 0.004, 0.0035, 0.0015, 3, led, (0, FRONT - 0.0112, -H * 0.43), cuts=12)
rounded_box("power_led", 0.006, 0.004, 0.006, 0.002, 3, led, (sw * 0.44, FRONT - 0.0112, -H * 0.43))
for sx in (-1, 1):
    for sz in (-1, 1):
        cyl(f"screw_{sx}_{sz}", 0.0055, 0.004, (sx * W * 0.33, D * 0.86, sz * H * 0.3), steel, rot=(math.radians(90), 0, 0), verts=24)
for i in range(9):
    rounded_box(f"vent{i}", W * 0.42, 0.006, 0.006, 0.0025, 2, bezel, (0, D * 0.86, H * 0.18 - i * 0.017), cuts=8)
rounded_box("port_panel", 0.006, D * 0.55, H * 0.32, 0.003, 3, bezel, (W / 2 + 0.002, 0.01, -H * 0.12))
plug_pts = []
for k, z in enumerate((-H * 0.06, -H * 0.18)):
    cyl(f"plug{k}", 0.0085, 0.03, (W / 2 + 0.017, 0.012, z), steel, rot=(0, math.radians(90), 0), verts=24)
    plug_pts.append(bend_co(Vector((W / 2 + 0.032, 0.012, z))))
head_parts = parts[head_parts_start:]
bpy.context.view_layer.update()
for o in head_parts:
    # modifiers that are not applied yet (weighted normals, cylinder bevels) run after the bend, which is fine
    bend(o)
log("bent", len(head_parts), "head parts, radius", R_CURVE)

# ================================================================== heavy mechanical neck
TOP = -H / 2
NECK_LEN = 0.13
BASE = TOP - NECK_LEN                # where the mount ring meets her neck
Y0 = 0.005
cyl("mount_plate", 0.066, 0.016, (0, Y0, TOP - 0.008), dark_alu, bevel=0.003)
for k in range(8):
    a = math.radians(22.5 + k * 45)
    cyl(f"plate_bolt{k}", 0.0045, 0.006, (math.cos(a) * 0.056, Y0 + math.sin(a) * 0.056, TOP - 0.018), steel, verts=6)
sphere("gimbal_ball", 0.028, (0, Y0, TOP - 0.034), steel)
cyl("gimbal_cup", 0.034, 0.016, (0, Y0, TOP - 0.048), bezel, bevel=0.002)
for sx in (-1, 1):                    # servo housings either side of the gimbal
    rounded_box(f"servo{sx}", 0.026, 0.034, 0.03, 0.005, 3, dark_alu, (sx * 0.046, Y0, TOP - 0.036))
    cyl(f"servo_cap{sx}", 0.011, 0.006, (sx * 0.061, Y0, TOP - 0.036), steel, rot=(0, math.radians(90), 0), verts=32)
# spine: vertebrae on spacers inside four armoured shroud plates
z = TOP - 0.06
for i in range(4):
    cyl(f"spacer{i}", 0.024, 0.008, (0, Y0, z), steel); z -= 0.008
    v = cyl(f"vertebra{i}", 0.042 - i * 0.0012, 0.011, (0, Y0, z), alu, bevel=0.003)
    v.rotation_euler = (math.radians(2.5 * (-1) ** i), math.radians(1.5 * (-1) ** (i + 1)), 0)
    z -= 0.011
SPINE_LO = z
for k in range(4):                    # shroud plates: curved slabs with gaps between them
    a0 = math.radians(k * 90 + 10)
    bm = bmesh.new()
    segs = 12; r_in, r_out = 0.047, 0.053; z0, z1 = SPINE_LO + 0.01, TOP - 0.056
    rows = []
    for j in range(segs + 1):
        a = a0 + math.radians(70) * j / segs
        rows.append([bm.verts.new((math.cos(a) * r, Y0 + math.sin(a) * r, zz)) for r in (r_in, r_out) for zz in (z0, z1)])
    for j in range(segs):
        p, q = rows[j], rows[j + 1]
        for f in ((p[0], q[0], q[1], p[1]), (p[2], p[3], q[3], q[2]), (p[1], q[1], q[3], p[3]), (p[0], p[2], q[2], q[0])):
            bm.faces.new(f)
    bm.faces.new((rows[0][0], rows[0][1], rows[0][3], rows[0][2])); bm.faces.new((rows[-1][0], rows[-1][2], rows[-1][3], rows[-1][1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(f"shroud{k}"); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(f"shroud{k}", me); scene.collection.objects.link(ob)
    bvm = ob.modifiers.new("bevel", "BEVEL"); bvm.width = 0.0015; bvm.segments = 2
    finish(ob, dark_alu)
torus("light_ring", 0.044, 0.0024, (0, Y0, SPINE_LO + 0.03), led)

# mount ring: thick, two bolt rows, a gasket lip that SINKS into the skin, and a soft light ring facing down
RING_R = 0.07                         # export_web.py scales the head by this ring's width
NECK_R = RING_R / 1.12                # the ring is drawn 1.12x the photo neck's width (see export_web.py)
collar = cyl("collar", RING_R, 0.034, (0, Y0, BASE + 0.019), dark_alu, verts=96, bevel=0.004)
cyl("collar_band", RING_R + 0.003, 0.008, (0, Y0, BASE + 0.026), steel, verts=96, bevel=0.0015)
for row, zz in enumerate((BASE + 0.012, BASE + 0.03)):
    for k in range(12):
        a = math.radians(k * 30 + row * 15)
        bolt = cyl(f"ring_bolt{row}_{k}", 0.0046, 0.006, (math.cos(a) * (RING_R + 0.001), Y0 + math.sin(a) * (RING_R + 0.001), zz), steel, verts=6)
        bolt.rotation_mode = "QUATERNION"; bolt.rotation_quaternion = Vector((math.cos(a), math.sin(a), 0)).to_track_quat("Z", "Y")
cyl("ring_top", 0.062, 0.006, (0, Y0, BASE + 0.039), bezel, bevel=0.002)
LIP_Z = BASE - 0.004                  # the gasket lip goes 4 mm below the ring, into the flesh
GASKET_R = RING_R / 1.12 - 0.005     # the inner gasket is smaller than the neck: it presses into the flesh
cyl("ring_floor", RING_R - 0.002, 0.004, (0, Y0, BASE + 0.001), dark_alu, verts=96)
torus("gasket", GASKET_R, 0.0055, (0, Y0, LIP_Z), gasket)
torus("skin_light", GASKET_R + 0.007, 0.0016, (0, Y0, BASE - 0.0005), led_soft)
glow_lights = []
for k in range(8):                    # small blue lights just above the skin, so the glow scatters into it
    a = math.radians(k * 45)
    ld = bpy.data.lights.new(f"skin_glow{k}", "POINT"); ld.energy = 0.05; ld.color = (0.25, 0.6, 1.0); ld.shadow_soft_size = 0.012
    lo = bpy.data.objects.new(f"skin_glow{k}", ld); scene.collection.objects.link(lo)
    lo.location = (math.cos(a) * (NECK_R + 0.004), Y0 + math.sin(a) * (NECK_R + 0.004), BASE - 0.002)
    glow_lights.append(lo)

# four pistons, ring to plate
for k, a in enumerate((205, 335, 25, 155)):
    ar = math.radians(a)
    lo_ = Vector((math.cos(ar) * 0.058, Y0 + math.sin(ar) * 0.058, BASE + 0.042))
    hi_ = Vector((math.cos(ar) * 0.05, Y0 + math.sin(ar) * 0.05, TOP - 0.016))
    mid = lo_ + (hi_ - lo_) * 0.55
    between(f"piston_barrel{k}", lo_, mid, 0.0085, alu)
    between(f"piston_rod{k}", mid, hi_, 0.0038, chrome)
    sphere(f"piston_lo{k}", 0.0068, lo_, steel); sphere(f"piston_hi{k}", 0.006, hi_, steel)

# rear cable loom: three cables from the back of the head down the back of the spine into the ring
for k in range(3):
    x = -0.012 + k * 0.012
    tube(f"loom{k}", [Vector((x, 0.06, -H * 0.42)), Vector((x * 1.4, 0.07, TOP - 0.05)), Vector((x * 1.2, 0.058, BASE + 0.045))], 0.0032, rubber)
# side cables from the ports, down into the mount plate
for k, start in enumerate(plug_pts):
    tube(f"cable{k}", [start, Vector((W / 2 + 0.03 - k * 0.012, 0.05 + k * 0.02, -H * 0.45)), Vector((0.03 - k * 0.015, 0.045, TOP - 0.06 - k * 0.02))], 0.0045, rubber)
# two hydraulic hoses: from fittings on the ring, down and out to where the shirt collar is.
# They end well below the ring; export_web.py lays the collar back over them so they vanish into the suit.
HOSE_ENDS = []
for sx in (-1, 1):
    fit = Vector((sx * (RING_R + 0.004), Y0 + 0.01, BASE + 0.016))
    cyl(f"hose_fitting{sx}", 0.0085, 0.016, fit + Vector((sx * 0.006, 0, 0)), steel, rot=(0, math.radians(90), 0), verts=6, bevel=0.001)
    end = Vector((sx * 0.094, Y0 + 0.04, BASE - 0.08))
    tube(f"hose{sx}", [fit + Vector((sx * 0.012, 0, 0)), Vector((sx * 0.088, Y0 + 0.02, BASE - 0.01)), Vector((sx * 0.092, Y0 + 0.032, BASE - 0.045)), end], 0.0062, hose)
    HOSE_ENDS.append(end)

# ================================================================== the skin stump under the ring
# A short neck section with real SSS. Its radius matches the photographed neck (wider than the ring),
# it bulges where the gasket lip presses in, and it fades out toward the bottom.
STUMP_TOP, STUMP_BOT = BASE + 0.006, BASE - 0.04
bm = bmesh.new()
rings_v = []
NZ, NA = 40, 96
for j in range(NZ + 1):
    zz = STUMP_TOP + (STUMP_BOT - STUMP_TOP) * j / NZ
    t = LIP_Z - zz                                                      # mm below the lip (negative = above)
    rise = 1.0 / (1.0 + math.exp(-(t + 0.001) / 0.0018))                # 0 inside the ring -> 1 below the lip
    r = (GASKET_R - 0.003) + (NECK_R - (GASKET_R - 0.003)) * rise       # flesh slopes up and in, under the gasket
    r += 0.003 * math.exp(-((t - 0.006) / 0.0045) ** 2)                 # flesh bulging out where the lip presses
    r += 0.002 * max(0.0, t) / 0.08                                     # the neck widens slightly downward
    row = []
    for i in range(NA):
        a = 2 * math.pi * i / NA
        rr = r * (1.0 + 0.03 * math.cos(2 * a))                         # a neck is wider than deep
        row.append(bm.verts.new((math.cos(a) * rr, Y0 + math.sin(a) * rr * 0.92, zz)))
    rings_v.append(row)
for j in range(NZ):
    for i in range(NA):
        bm.faces.new((rings_v[j][i], rings_v[j][(i + 1) % NA], rings_v[j + 1][(i + 1) % NA], rings_v[j + 1][i]))
bm.faces.new(rings_v[0][::-1])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
me = bpy.data.meshes.new("neck_skin"); bm.to_mesh(me); bm.free()
stump = bpy.data.objects.new("neck_skin", me); scene.collection.objects.link(stump)
finish(stump, skin_m)
# fade: opaque down to 3 cm below the ring, transparent by the bottom (object Z; the stump's origin is the world origin)
SKIN_FADE.inputs["From Min"].default_value = BASE - 0.032; SKIN_FADE.inputs["From Max"].default_value = BASE - 0.012
SKIN_FADE.inputs["To Min"].default_value = 0.0; SKIN_FADE.inputs["To Max"].default_value = 1.0

# ================================================================== assemble, light, camera
root = bpy.data.objects.new("nine_head", None); scene.collection.objects.link(root)
for p in parts + glow_lights: p.parent = root
root.rotation_euler = (math.radians(-2), 0, math.radians(YAW))

def area(name, energy, loc, rot, size, color=(1, 1, 1)):
    d = bpy.data.lights.new(name, "AREA"); d.energy = energy; d.size = size; d.color = color; d.shape = "RECTANGLE"; d.size_y = size * 0.7
    o = bpy.data.objects.new(name, d); scene.collection.objects.link(o)
    o.location = loc; o.rotation_euler = [math.radians(v) for v in rot]; o.visible_glossy = False
area("key", 180, (0.9, -1.0, 0.75), (55, 0, 40), 1.4, (1, 0.97, 0.94))
area("fill", 70, (-1.1, -0.8, 0.3), (75, 0, -55), 1.8, (0.92, 0.95, 1))
area("rim", 140, (-0.4, 0.9, 0.7), (-55, 0, 200), 1.0, (0.85, 0.92, 1))
area("top", 60, (0, -0.2, 1.1), (0, 0, 0), 1.6)
# reflection cards (seen only in reflections): long studio highlights along the curved glass
for i, (loc, rot, scl, strength) in enumerate((((-1.05, -1.1, 0.25), (90, 0, -55), (0.06, 1.1), 0.45),
                                              ((1.05, -1.1, 0.25), (90, 0, 55), (0.06, 1.1), 0.45),
                                              ((0.0, -1.1, 0.9), (60, 0, 0), (0.5, 0.03), 0.35))):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=[math.radians(v) for v in rot])
    card = bpy.context.active_object; card.scale = (scl[0], scl[1], 1)
    m = bpy.data.materials.new(f"card{i}"); m.use_nodes = True
    em = m.node_tree.nodes.new("ShaderNodeEmission"); em.inputs["Strength"].default_value = strength
    m.node_tree.links.new(em.outputs[0], m.node_tree.nodes["Material Output"].inputs["Surface"])
    card.data.materials.append(m); card.visible_camera = False

world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.28, 0.29, 0.31, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.6

cam_d = bpy.data.cameras.new("cam"); cam_d.lens = 85
cam = bpy.data.objects.new("cam", cam_d); scene.collection.objects.link(cam); scene.camera = cam
cam.location = (0, -1.55, -0.1); cam.rotation_euler = (math.radians(90), 0, 0)
cam_d.dof.use_dof = True; cam_d.dof.focus_distance = 1.55 - D / 2; cam_d.dof.aperture_fstop = 4.0

scene.render.engine = "CYCLES"; scene.cycles.samples = SAMPLES; scene.cycles.use_denoising = True
scene.cycles.max_bounces = 12; scene.cycles.transmission_bounces = 12; scene.cycles.transparent_max_bounces = 16
try:
    pr = bpy.context.preferences.addons["cycles"].preferences; pr.get_devices(); pr.compute_device_type = "OPTIX"
    for dv in pr.devices: dv.use = True
    scene.cycles.device = "GPU"
except Exception as e:
    log("cpu", e)
scene.render.resolution_x, scene.render.resolution_y = 1400, 1400
scene.render.film_transparent = True
scene.view_settings.view_transform = "AgX"; scene.view_settings.look = "AgX - Medium High Contrast"
scene.render.image_settings.file_format = "PNG"; scene.render.image_settings.color_mode = "RGBA"
for nm in filter(None, os.environ.get("NINE_HIDE", "").split(",")):     # debugging: hide parts by name
    ob = bpy.data.objects.get(nm)
    if ob: ob.hide_render = True
if os.environ.get("NINE_RES"): scene.render.resolution_x = scene.render.resolution_y = int(os.environ["NINE_RES"])
scene.render.filepath = os.path.join(OUT, "display_head.png")
bpy.ops.render.render(write_still=True)
log("rendered", scene.render.filepath)

# ================================================================== where things are in the image
bpy.context.view_layer.update()
def px(p):
    c = world_to_camera_view(scene, cam, p)
    return [round(c.x * scene.render.resolution_x, 1), round((1 - c.y) * scene.render.resolution_y, 1)]
mw = screen.matrix_world
# the panel's vertices keep their order through bending, so find them by their flat (pre-bend) position
def panel_point(u, v):                 # u, v in 0..1 from the top-left corner
    tx, tz = -sw / 2 + u * sw, (0.5 - v) * sh
    i = min(range(len(GRID_LOCAL)), key=lambda k: (GRID_LOCAL[k].x - tx) ** 2 + (GRID_LOCAL[k].z - tz) ** 2)
    return px(mw @ screen.data.vertices[i].co)
COLS, ROWS = 9, 5
grid = [[panel_point(c / (COLS - 1), r / (ROWS - 1)) for c in range(COLS)] for r in range(ROWS)]
info = {"size": [scene.render.resolution_x, scene.render.resolution_y],
        "screen": {"tl": grid[0][0], "tr": grid[0][-1], "br": grid[-1][-1], "bl": grid[-1][0]},
        "screen_grid": {"cols": COLS, "rows": ROWS, "points": grid},
        "collar_bottom": px(collar.matrix_world @ Vector((0, 0, -0.017))),
        "collar_width_px": abs(px(collar.matrix_world @ Vector((RING_R, 0, -0.017)))[0] - px(collar.matrix_world @ Vector((-RING_R, 0, -0.017)))[0]),
        "hose_ends": [px(root.matrix_world @ e) for e in HOSE_ENDS]}
json.dump(info, open(os.path.join(OUT, "display_head.json"), "w"), indent=2)
log("info", {k: info[k] for k in ("screen", "collar_bottom", "collar_width_px", "hose_ends")})
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "display_head.blend"))
