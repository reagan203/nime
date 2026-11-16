"""Nine's display head at "Lisa" quality, original design: a modern professional display
(graphite aluminium, satin bezel, curved glass with specks, blue light strip, screws, vents,
ports, braided cables into a neck collar). Renders a transparent PNG for compositing onto
the photographic body, plus the screen's corners for a live face.
Run: blender --background --factory-startup --python display_head.py -- <out_dir> [yaw_deg] [samples] [resolution]
"""
import bpy, bmesh, math, os, sys, json
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

args = sys.argv[sys.argv.index("--") + 1:]
OUT = args[0]; YAW = float(args[1]) if len(args) > 1 else -9.0; SAMPLES = int(args[2]) if len(args) > 2 else 256
os.makedirs(OUT, exist_ok=True)
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
scene = bpy.context.scene
def log(*a): print("[head]", *a, flush=True)

# ------------------------------------------------------------------ materials
def principled(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    return m, m.node_tree, m.node_tree.nodes["Principled BSDF"]
def noise_into(nt, socket, scale, lo, hi, detail=6.0, coord="Object"):
    tc = nt.nodes.new("ShaderNodeTexCoord"); nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale; nz.inputs["Detail"].default_value = detail
    nt.links.new(tc.outputs[coord], nz.inputs["Vector"])
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

alu, nt, b = principled("graphite_aluminium")
b.inputs["Base Color"].default_value = (0.055, 0.06, 0.068, 1); b.inputs["Metallic"].default_value = 1.0
noise_into(nt, b.inputs["Roughness"], 260, 0.26, 0.4)
if "Anisotropic" in b.inputs: b.inputs["Anisotropic"].default_value = 0.55
bump(nt, b, 900, 0.025, stretch=(1, 1, 60))                      # brushed grain

bezel, nt, b = principled("satin_bezel")
b.inputs["Base Color"].default_value = (0.018, 0.019, 0.022, 1)
noise_into(nt, b.inputs["Roughness"], 400, 0.42, 0.55); bump(nt, b, 1500, 0.04)

glass, nt, b = principled("screen_glass")
b.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1); b.inputs["Roughness"].default_value = 0.025
if "Coat Weight" in b.inputs: b.inputs["Coat Weight"].default_value = 1.0
# dark screen with faint drifting specks, like a live display in standby
tc = nt.nodes.new("ShaderNodeTexCoord"); vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 220
nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
ramp = nt.nodes.new("ShaderNodeValToRGB"); ramp.color_ramp.elements[0].position = 0.0; ramp.color_ramp.elements[1].position = 0.06
ramp.color_ramp.elements[0].color = (1, 1, 1, 1); ramp.color_ramp.elements[1].color = (0, 0, 0, 1)
nt.links.new(vor.outputs["Distance"], ramp.inputs["Fac"])
glow = nt.nodes.new("ShaderNodeMix"); glow.data_type = "RGBA"; glow.blend_type = "ADD"; glow.inputs[0].default_value = 1.0
glow.inputs[6].default_value = (0.012, 0.03, 0.055, 1)
nt.links.new(ramp.outputs["Color"], glow.inputs[7])
nt.links.new(glow.outputs[2], b.inputs["Emission Color"]); b.inputs["Emission Strength"].default_value = 0.9

led, nt, b = principled("brand_led")
b.inputs["Base Color"].default_value = (0.05, 0.45, 0.85, 1)
b.inputs["Emission Color"].default_value = (0.1, 0.55, 1.0, 1); b.inputs["Emission Strength"].default_value = 6.0

steel, nt, b = principled("brushed_steel")
b.inputs["Base Color"].default_value = (0.62, 0.64, 0.67, 1); b.inputs["Metallic"].default_value = 1.0
noise_into(nt, b.inputs["Roughness"], 300, 0.22, 0.34)
if "Anisotropic" in b.inputs: b.inputs["Anisotropic"].default_value = 0.7
bump(nt, b, 800, 0.02, stretch=(1, 60, 1))

rubber, nt, b = principled("braided_cable")
b.inputs["Base Color"].default_value = (0.02, 0.022, 0.026, 1); b.inputs["Roughness"].default_value = 0.6
bump(nt, b, 2200, 0.25, stretch=(1, 1, 8))

# ------------------------------------------------------------------ geometry
W, H, D = 0.34, 0.255, 0.16
def rounded_box(name, w, d, h, bevel, segs, mat, loc=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = (w, d, h)
    bpy.ops.object.transform_apply(scale=True)
    m = o.modifiers.new("bevel", "BEVEL"); m.width = bevel; m.segments = segs; m.limit_method = "NONE"
    o.modifiers.new("wn", "WEIGHTED_NORMAL")
    o.data.materials.append(mat); bpy.ops.object.shade_smooth(); return o

root = bpy.data.objects.new("nine_head", None); scene.collection.objects.link(root)
parts = []
parts.append(rounded_box("shell", W, D, H, 0.028, 8, alu))
parts.append(rounded_box("rear_housing", W * 0.78, D * 0.45, H * 0.78, 0.035, 8, alu, (0, D * 0.62, 0)))
parts.append(rounded_box("bezel", W * 0.955, 0.012, H * 0.94, 0.02, 6, bezel, (0, -D / 2 - 0.004, 0)))

# curved glass screen
sw, sh = W * 0.86, H * 0.78
bpy.ops.mesh.primitive_grid_add(x_subdivisions=40, y_subdivisions=30, size=1, location=(0, -D / 2 - 0.0115, 0.006), rotation=(math.radians(90), 0, 0))
screen = bpy.context.active_object; screen.name = "screen"; screen.scale = (sw, sh, 1)
bpy.ops.object.transform_apply(scale=True)
for v in screen.data.vertices:          # gentle outward bulge
    v.co.y -= 0.006 * (1 - (2 * v.co.x / sw) ** 2) * (1 - (2 * v.co.z / sh) ** 2)
sb = screen.modifiers.new("bevel", "BEVEL"); sb.width = 0.016; sb.segments = 6; sb.affect = "VERTICES"
screen.data.materials.append(glass); bpy.ops.object.shade_smooth(); parts.append(screen)

# brand light strip and power light on the lower bezel
parts.append(rounded_box("light_strip", sw * 0.5, 0.004, 0.0035, 0.0015, 3, led, (0, -D / 2 - 0.0112, -H * 0.43)))
parts.append(rounded_box("power_led", 0.006, 0.004, 0.006, 0.002, 3, led, (sw * 0.44, -D / 2 - 0.0112, -H * 0.43)))

# corner screws on the rear housing
for sx in (-1, 1):
    for sz in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.0055, depth=0.004, location=(sx * W * 0.33, D * 0.86, sz * H * 0.3), rotation=(math.radians(90), 0, 0))
        s = bpy.context.active_object; s.data.materials.append(steel); parts.append(s)
# rear vents
for i in range(9):
    parts.append(rounded_box(f"vent{i}", W * 0.42, 0.006, 0.006, 0.0025, 2, bezel, (0, D * 0.86, H * 0.18 - i * 0.017)))
# side port panel and two plugs
parts.append(rounded_box("port_panel", 0.006, D * 0.55, H * 0.32, 0.003, 3, bezel, (W / 2 + 0.002, 0.01, -H * 0.12)))
plug_pts = []
for k, z in enumerate((-H * 0.06, -H * 0.18)):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0085, depth=0.03, location=(W / 2 + 0.017, 0.012, z), rotation=(0, math.radians(90), 0))
    p = bpy.context.active_object; p.data.materials.append(steel); parts.append(p)
    plug_pts.append(Vector((W / 2 + 0.032, 0.012, z)))

# ------------------------------------------------------------------ mechanical neck
# From the bottom: a steel mount ring on her neck (bolted, rubber gasket), an articulated
# spine of graphite vertebrae on steel spacers with a blue light ring, three hydraulic
# pistons, a ball-joint gimbal and a mounting plate under the head. Cables run alongside.
def cyl(name, r, depth, loc, mat, rot=(0, 0, 0), verts=64, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; o.data.materials.append(mat)
    if bevel:
        bm = o.modifiers.new("bevel", "BEVEL"); bm.width = bevel; bm.segments = 3; bm.limit_method = "ANGLE"
    bpy.ops.object.shade_smooth(); parts.append(o); return o
def between(name, a, b, r, mat, verts=32):
    a, b = Vector(a), Vector(b); d = b - a
    o = cyl(name, r, d.length, (a + b) / 2, mat, verts=verts)
    o.rotation_mode = "QUATERNION"; o.rotation_quaternion = d.to_track_quat("Z", "Y"); return o
def sphere(name, r, loc, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=48, ring_count=24)
    o = bpy.context.active_object; o.name = name; o.data.materials.append(mat); bpy.ops.object.shade_smooth(); parts.append(o); return o

chrome, nt, b = principled("chrome_rod")
b.inputs["Base Color"].default_value = (0.9, 0.91, 0.93, 1); b.inputs["Metallic"].default_value = 1.0; b.inputs["Roughness"].default_value = 0.06
gasket, nt, b = principled("rubber_gasket")
b.inputs["Base Color"].default_value = (0.012, 0.012, 0.014, 1); b.inputs["Roughness"].default_value = 0.75

TOP = -H / 2                       # underside of the head
NECK_LEN = 0.13
BASE = TOP - NECK_LEN              # where the mount ring meets her neck
Y0 = 0.005
# mounting plate and gimbal under the head
cyl("mount_plate", 0.062, 0.012, (0, Y0, TOP - 0.006), alu, bevel=0.003)
for k in range(6):                 # plate bolts
    a = math.radians(30 + k * 60)
    cyl(f"plate_bolt{k}", 0.0042, 0.006, (math.cos(a) * 0.052, Y0 + math.sin(a) * 0.052, TOP - 0.014), steel, verts=6)
sphere("gimbal_ball", 0.026, (0, Y0, TOP - 0.03), steel)
cyl("gimbal_cup", 0.031, 0.014, (0, Y0, TOP - 0.042), bezel, bevel=0.002)
# spine: vertebrae on spacers, each tilted a touch so it reads as articulated
z = TOP - 0.056
for i in range(4):
    cyl(f"spacer{i}", 0.022, 0.008, (0, Y0, z), steel); z -= 0.008
    v = cyl(f"vertebra{i}", 0.04 - i * 0.0015, 0.011, (0, Y0, z), alu, bevel=0.003)
    v.rotation_euler = (math.radians(2.5 * (-1) ** i), math.radians(1.5 * (-1) ** (i + 1)), 0)
    if i == 1:
        bpy.ops.mesh.primitive_torus_add(major_radius=0.041, minor_radius=0.0022, location=(0, Y0, z))
        lr = bpy.context.active_object; lr.name = "light_ring"; lr.data.materials.append(led); parts.append(lr)
    z -= 0.011
# mount ring on her neck (radius 0.07 so the composite scale stays the same), gasket and bolts
collar = cyl("collar", 0.07, 0.03, (0, Y0, BASE + 0.015), steel, verts=96, bevel=0.004)
bpy.ops.mesh.primitive_torus_add(major_radius=0.07, minor_radius=0.006, location=(0, Y0, BASE + 0.001))
ring = bpy.context.active_object; ring.name = "gasket"; ring.data.materials.append(gasket); parts.append(ring)
for k in range(10):
    a = math.radians(k * 36)
    bolt = cyl(f"ring_bolt{k}", 0.0048, 0.006, (math.cos(a) * 0.071, Y0 + math.sin(a) * 0.071, BASE + 0.016), steel, verts=6)
    bolt.rotation_mode = "QUATERNION"; bolt.rotation_quaternion = Vector((math.cos(a), math.sin(a), 0)).to_track_quat("Z", "Y")
cyl("ring_top", 0.06, 0.006, (0, Y0, BASE + 0.033), bezel, bevel=0.002)
# three hydraulic pistons: barrel from the ring, chrome rod up to the plate, ball ends
for k, a in enumerate((205, 335, 90)):
    ar = math.radians(a)
    lo = Vector((math.cos(ar) * 0.054, Y0 + math.sin(ar) * 0.054, BASE + 0.036))
    hi = Vector((math.cos(ar) * 0.047, Y0 + math.sin(ar) * 0.047, TOP - 0.013))
    mid = lo + (hi - lo) * 0.55
    between(f"piston_barrel{k}", lo, mid, 0.0075, alu)
    between(f"piston_rod{k}", mid, hi, 0.0036, chrome)
    sphere(f"piston_lo{k}", 0.0062, lo, steel); sphere(f"piston_hi{k}", 0.0055, hi, steel)
# a thin brand-blue cable spiralling up the spine
cu = bpy.data.curves.new("spine_cable", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.0022; cu.bevel_resolution = 4
sp = cu.splines.new("NURBS"); n = 24; sp.points.add(n - 1)
for i, pt in enumerate(sp.points):
    t = i / (n - 1); a = t * math.pi * 3
    pt.co = (math.cos(a) * 0.033, Y0 + math.sin(a) * 0.033, BASE + 0.04 + t * (TOP - 0.05 - BASE - 0.04), 1)
sp.use_endpoint_u = True; sp.order_u = 4
ob = bpy.data.objects.new("spine_cable", cu); ob.data.materials.append(led); scene.collection.objects.link(ob); parts.append(ob)

# braided cables from the side ports, curving down into the back of the mount plate
for k, start in enumerate(plug_pts):
    cu = bpy.data.curves.new(f"cable{k}", "CURVE"); cu.dimensions = "3D"
    cu.bevel_depth = 0.0045; cu.bevel_resolution = 6
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(2)
    pts = [start, Vector((W / 2 + 0.05 - k * 0.01, 0.05 + k * 0.02, -H * 0.45)), Vector((0.03 - k * 0.015, 0.045, TOP - 0.06 - k * 0.02))]
    for bp, co in zip(sp.bezier_points, pts):
        bp.co = co; bp.handle_left_type = bp.handle_right_type = "AUTO"
    ob = bpy.data.objects.new(f"cable{k}", cu); ob.data.materials.append(rubber)
    scene.collection.objects.link(ob); parts.append(ob)

# ------------------------------------------------------------------ v2: more mechanical definition
# Head: a parting seam, side cooling fins, hex screws in the bezel corners, a camera module.
# Neck: a toothed gear ring at the gimbal, two servo motors with linkages, ribbed vertebrae,
# knurled rings on the pistons, status lights and a knurled grip on the collar, a second cable.
def add(o): parts.append(o); return o
anod, nt, b = principled("anodised_metal")             # blue-grey anodised aluminium, so the mechanics read against the dark head
b.inputs["Base Color"].default_value = (0.11, 0.15, 0.21, 1); b.inputs["Metallic"].default_value = 1.0
noise_into(nt, b.inputs["Roughness"], 300, 0.28, 0.38); bump(nt, b, 1200, 0.02)
def radial(name, n, radius, z, size, mat, y0=Y0, phase=0.0, bevel=0.001):
    for k in range(n):
        a = phase + 2 * math.pi * k / n
        o = add(rounded_box(f"{name}{k}", *size, bevel, 2, mat, (math.cos(a) * radius, y0 + math.sin(a) * radius, z)))
        o.rotation_euler = (0, 0, a)

# parting seam around the shell (a dark line where front and back halves meet)
add(rounded_box("seam", W + 0.0016, 0.0028, H + 0.0016, 0.028, 8, gasket, (0, 0.014, 0)))
# side cooling fins
for sx in (-1, 1):
    for i in range(7):
        add(rounded_box(f"fin{sx}_{i}", 0.0042, D * 0.46, 0.0042, 0.0016, 2, bezel, (sx * (W / 2 + 0.0016), 0.028, H * 0.3 - i * 0.021)))
# hex screws in the four bezel corners
for sx in (-1, 1):
    for sz in (-1, 1):
        cyl(f"bezel_screw{sx}{sz}", 0.0034, 0.003, (sx * W * 0.452, -D / 2 - 0.0108, sz * H * 0.425), steel, rot=(math.radians(90), 0, 0), verts=6)
# camera module and its indicator, centred on the top bezel
cyl("cam_ring", 0.0058, 0.003, (0, -D / 2 - 0.0106, H * 0.447), steel, rot=(math.radians(90), 0, 0), bevel=0.0006)
cyl("cam_lens", 0.0036, 0.004, (0, -D / 2 - 0.0112, H * 0.447), glass, rot=(math.radians(90), 0, 0))
cyl("cam_led", 0.0013, 0.003, (0.012, -D / 2 - 0.0108, H * 0.447), led, rot=(math.radians(90), 0, 0), verts=16)

# toothed gear ring around the gimbal cup
cyl("gear_hub", 0.033, 0.008, (0, Y0, TOP - 0.042), anod, bevel=0.001)
radial("gear_tooth", 30, 0.0352, TOP - 0.042, (0.0042, 0.005, 0.0075), anod)
# two servo motors either side of the gimbal, with output horns and links to the ball
for sx in (-1, 1):
    cx = sx * 0.062
    add(rounded_box(f"servo{sx}", 0.026, 0.032, 0.024, 0.003, 3, anod, (cx, Y0 + 0.004, TOP - 0.034)))
    add(rounded_box(f"servo_label{sx}", 0.0005, 0.018, 0.008, 0.0002, 1, led, (cx + sx * 0.0132, Y0 - 0.004, TOP - 0.03)))
    cyl(f"servo_horn{sx}", 0.0085, 0.004, (cx + sx * 0.015, Y0 + 0.004, TOP - 0.034), steel, rot=(0, math.radians(90), 0), bevel=0.0008)
    cyl(f"servo_hub{sx}", 0.003, 0.006, (cx + sx * 0.017, Y0 + 0.004, TOP - 0.034), chrome, rot=(0, math.radians(90), 0), verts=6)
    for k in (-1, 1):
        cyl(f"servo_screw{sx}{k}", 0.0018, 0.004, (cx, Y0 - 0.012, TOP - 0.034 + k * 0.008), steel, rot=(math.radians(90), 0, 0), verts=6)
    between(f"servo_link{sx}", (cx - sx * 0.013, Y0 - 0.006, TOP - 0.03), (sx * 0.02, Y0 - 0.008, TOP - 0.03), 0.0026, chrome)
# ribs around each vertebra
zr = TOP - 0.056
for i in range(4):
    zr -= 0.008
    radial(f"rib{i}_", 14, 0.04 - i * 0.0015 + 0.0012, zr, (0.0048, 0.0036, 0.0095), alu, phase=i * 0.12)
    zr -= 0.011
# knurled rings and end caps on the pistons
for k, a in enumerate((205, 335, 90)):
    ar = math.radians(a)
    lo = Vector((math.cos(ar) * 0.054, Y0 + math.sin(ar) * 0.054, BASE + 0.036))
    hi = Vector((math.cos(ar) * 0.047, Y0 + math.sin(ar) * 0.047, TOP - 0.013))
    d = hi - lo; q = d.to_track_quat("Z", "Y")
    for f in (0.12, 0.2, 0.5):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.0082, minor_radius=0.0016, location=lo + d * f, major_segments=32, minor_segments=8)
        t = add(bpy.context.active_object); t.name = f"piston_knurl{k}_{f}"; t.data.materials.append(steel)
        t.rotation_mode = "QUATERNION"; t.rotation_quaternion = q
    cap = between(f"piston_cap{k}", lo + d * 0.53, lo + d * 0.57, 0.0084, steel)
# collar: a knurled grip band and three status lights at the front
radial("collar_knurl", 72, 0.0712, BASE + 0.006, (0.0016, 0.0024, 0.0075), steel)
for k, a in enumerate((255, 270, 285)):
    ar = math.radians(a)
    o = cyl(f"status_led{k}", 0.0022, 0.003, (math.cos(ar) * 0.0712, Y0 + math.sin(ar) * 0.0712, BASE + 0.024), led, verts=16)
    o.rotation_mode = "QUATERNION"; o.rotation_quaternion = Vector((math.cos(ar), math.sin(ar), 0)).to_track_quat("Z", "Y")
# a second, dark cable spiralling the other way
cu = bpy.data.curves.new("spine_cable2", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.0026; cu.bevel_resolution = 4
sp = cu.splines.new("NURBS"); n = 24; sp.points.add(n - 1)
for i, pt in enumerate(sp.points):
    t = i / (n - 1); a = math.pi - t * math.pi * 2.5
    pt.co = (math.cos(a) * 0.035, Y0 + math.sin(a) * 0.035, BASE + 0.04 + t * (TOP - 0.05 - BASE - 0.04), 1)
sp.use_endpoint_u = True; sp.order_u = 4
ob = bpy.data.objects.new("spine_cable2", cu); ob.data.materials.append(rubber); scene.collection.objects.link(ob); parts.append(ob)

for p in parts: p.parent = root
root.rotation_euler = (math.radians(-2), 0, math.radians(YAW))

# ------------------------------------------------------------------ studio light (soft, Lisa-like)
def area(name, energy, loc, rot, size, color=(1, 1, 1), visible=False):
    d = bpy.data.lights.new(name, "AREA"); d.energy = energy; d.size = size; d.color = color; d.shape = "RECTANGLE"; d.size_y = size * 0.7
    o = bpy.data.objects.new(name, d); scene.collection.objects.link(o)
    o.location = loc; o.rotation_euler = [math.radians(v) for v in rot]
    o.visible_glossy = False
area("key", 180, (0.9, -1.0, 0.75), (55, 0, 40), 1.4, (1, 0.97, 0.94))
area("fill", 70, (-1.1, -0.8, 0.3), (75, 0, -55), 1.8, (0.92, 0.95, 1))
area("rim", 140, (-0.4, 0.9, 0.7), (-55, 0, 200), 1.0, (0.85, 0.92, 1))
area("top", 60, (0, -0.2, 1.1), (0, 0, 0), 1.6)
area("neck_fill", 55, (0.15, -0.9, -0.45), (118, 0, 10), 0.9, (0.95, 0.97, 1))   # v2: lifts the neck's mechanics out of the shadow
# large reflection cards (seen only in reflections) give the glass and metal studio highlights
for i, (x, rz) in enumerate(((-1.05, -55), (1.05, 55))):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x, -1.1, 0.25), rotation=(math.radians(90), 0, math.radians(rz)))
    card = bpy.context.active_object; card.scale = (0.12, 1.1, 1)
    m = bpy.data.materials.new(f"card{i}"); m.use_nodes = True
    em = m.node_tree.nodes.new("ShaderNodeEmission"); em.inputs["Strength"].default_value = 1.2
    m.node_tree.links.new(em.outputs[0], m.node_tree.nodes["Material Output"].inputs["Surface"])
    card.data.materials.append(m); card.visible_camera = False

world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.28, 0.29, 0.31, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.6

# ------------------------------------------------------------------ camera (85 mm, eye level, shallow focus)
cam_d = bpy.data.cameras.new("cam"); cam_d.lens = 85
cam = bpy.data.objects.new("cam", cam_d); scene.collection.objects.link(cam); scene.camera = cam
cam.location = (0, -1.55, -0.08); cam.rotation_euler = (math.radians(90), 0, 0)
cam_d.dof.use_dof = True; cam_d.dof.focus_distance = 1.55 - D / 2; cam_d.dof.aperture_fstop = 4.0

scene.render.engine = "CYCLES"; scene.cycles.samples = SAMPLES; scene.cycles.use_denoising = True
try:
    pr = bpy.context.preferences.addons["cycles"].preferences; pr.get_devices(); pr.compute_device_type = "OPTIX"
    for dv in pr.devices: dv.use = True
    scene.cycles.device = "GPU"
except Exception as e:
    log("cpu", e)
RES = int(args[3]) if len(args) > 3 else 2000   # v2: 2000 px for more definition (was 1400)
scene.render.resolution_x, scene.render.resolution_y = RES, RES
scene.render.film_transparent = True
scene.view_settings.view_transform = "AgX"; scene.view_settings.look = "AgX - Medium High Contrast"
scene.render.image_settings.file_format = "PNG"; scene.render.image_settings.color_mode = "RGBA"
scene.render.filepath = os.path.join(OUT, "display_head.png")
bpy.ops.render.render(write_still=True)
log("rendered", scene.render.filepath)

# screen corners in the image + collar bottom (for placing onto the neck)
bpy.context.view_layer.update()
def px(p):
    c = world_to_camera_view(scene, cam, p)
    return [round(c.x * scene.render.resolution_x, 1), round((1 - c.y) * scene.render.resolution_y, 1)]
mw = screen.matrix_world
vs = [mw @ v.co for v in screen.data.vertices]
cx = sum(v.x for v in vs) / len(vs); cz = sum(v.z for v in vs) / len(vs)
def corner(l, u):
    pool = [v for v in vs if (v.x < cx) == l and (v.z > cz) == u]
    return max(pool, key=lambda v: abs(v.x - cx) + abs(v.z - cz))
info = {"size": [scene.render.resolution_x, scene.render.resolution_y],
        "screen": {"tl": px(corner(True, True)), "tr": px(corner(False, True)), "br": px(corner(False, False)), "bl": px(corner(True, False))},
        "collar_bottom": px(collar.matrix_world @ Vector((0, 0, -0.015))),
        "collar_width_px": abs(px(collar.matrix_world @ Vector((0.07, 0, -0.015)))[0] - px(collar.matrix_world @ Vector((-0.07, 0, -0.015)))[0])}
json.dump(info, open(os.path.join(OUT, "display_head.json"), "w"), indent=2)
log("info", info)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "display_head.blend"))
