import bpy, math
from pathlib import Path
ASSET_DIR = Path(__file__).resolve().parent
(ASSET_DIR / "renders" / "tide_anim").mkdir(parents=True, exist_ok=True)
from mathutils import Vector
# Replace scene with an image-led original character rig. Shape language traces the supplied Tide concept.
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
s=bpy.context.scene
s.render.engine='BLENDER_EEVEE_NEXT'; s.eevee.taa_render_samples=16
s.render.resolution_x=540;s.render.resolution_y=810;s.render.resolution_percentage=100;s.render.fps=30
s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.film_transparent=True
s.view_settings.view_transform='AgX'
def mat(n,c,metal=0,rough=.25,trans=0,emit=0):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;p.inputs['Transmission Weight'].default_value=trans
 if emit:p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=emit
 return m
skin=mat('Porcelain seafoam skin',(.58,.91,.85),.08,.22,.02)
hair=mat('Deep teal flowing glass',(.018,.22,.24),.38,.18,.07)
edge=mat('Aqua glass highlights',(.24,.91,.82),.24,.17,.1,.25)
gold=mat('Champagne gold',(.83,.60,.29),.7,.2)
white=mat('Pearl sclera',(.99,1,.97),.02,.16)
iris=mat('Deep jade iris',(.025,.36,.34),.18,.14)
pupil=mat('Obsidian pupil',(.004,.027,.031),.08,.08)
coral=mat('Warm blush',(.96,.50,.47),0,.34)
cloth=mat('Lagoon bodice',(.016,.12,.14),.4,.21)
root=bpy.data.objects.new('Tide • animated character root',None);bpy.context.collection.objects.link(root)
def uv(n,loc,sc,ma,seg=48,rings=32):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=loc);o=bpy.context.object;o.name=n;o.scale=sc;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(ma)
 for p in o.data.polygons:p.use_smooth=True
 o.parent=root;return o
def curve(n,pts,ma,b=.05,res=10):
 c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.resolution_u=24;c.bevel_depth=b;c.bevel_resolution=res;sp=c.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
 for q,v in zip(sp.bezier_points,pts):q.co=v;q.handle_left_type='AUTO';q.handle_right_type='AUTO'
 o=bpy.data.objects.new(n,c);bpy.context.collection.objects.link(o);o.data.materials.append(ma);o.parent=root;return o
# Elegant narrow torso flowing into an elongated taper.
uv('Sculpted torso',(0,0,-.28),(.40,.31,.62),skin)
uv('Tide jewel bodice',(0,-.018,-.27),(.37,.327,.42),cloth)
# Mermaid tail as smooth taper with swept and curled flukes.
levels=[(-2.70,.10),(-2.47,.16),(-2.19,.22),(-1.90,.28),(-1.62,.33),(-1.32,.34),(-1.03,.31),(-.78,.27)]
verts=[];faces=[];N=64
for z,r in levels:
 for i in range(N):
  a=math.tau*i/N;verts.append((r*math.cos(a),.02+r*.8*math.sin(a),z))
for j in range(len(levels)-1):
 for i in range(N):a=j*N+i;b=j*N+(i+1)%N;c=(j+1)*N+(i+1)%N;d=(j+1)*N+i;faces.append((a,b,c,d))
me=bpy.data.meshes.new('Sinuous tail mesh');me.from_pydata(verts,[],faces);me.materials.append(hair);ob=bpy.data.objects.new('Long flowing mermaid tail',me);bpy.context.collection.objects.link(ob);ob.parent=root
for p in me.polygons:p.use_smooth=True
sub=ob.modifiers.new('Silky contour','SUBSURF');sub.levels=2;sub.render_levels=2
# Swept flukes via leaf-shaped, curved meshes with glass edge.
def finmesh(name,side,points,material):
 verts=[(side*x,-.08,z) for x,z in points]+[(0,-.21,-2.55)];center=len(points);faces=[(center,i,(i+1)%center) for i in range(center)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.materials.append(material);ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);ob.parent=root
 for p in mesh.polygons:p.use_smooth=True
 solid=ob.modifiers.new('Fin thickness','SOLIDIFY');solid.thickness=.06
 su=ob.modifiers.new('Fluid swept edges','SUBSURF');su.levels=2;su.render_levels=2
 return ob
for side in (-1,1):
 pts=[(.08,-2.50),(.20,-2.30),(.48,-2.12),(.83,-2.02),(1.12,-2.08),(1.18,-2.23),(.96,-2.40),(.70,-2.59),(.42,-2.78),(.20,-2.85)]
 finmesh('Sweeping tail fan',side,pts,skin)
 curve('Fin luminous vein',[(side*.12,-.23,-2.53),(side*.42,-.24,-2.34),(side*.76,-.23,-2.16),(side*1.08,-.18,-2.11)],edge,.016,6)
# Neck and petite shoulders.
uv('Neck',(0,0,.40),(.18,.19,.39),skin)
for side in (-1,1):uv('Shoulder',(side*.38,0,.12),(.25,.24,.20),skin)
# Face/head, large on purpose with portrait proportions.
head=bpy.data.objects.new('Tide head rig',None);bpy.context.collection.objects.link(head);head.parent=root;head.location=(0,-.005,.94)
face=uv('Expressive porcelain face',(0,0,0),(.56,.40,.61),skin);face.parent=head
# Behind-head hair cap and many sculptural tapered flowing curls.
cap=uv('Glossy deep teal hair cap',(0,.095,.23),(.62,.43,.49),hair);cap.parent=head
for side in (-1,1):
 # signature tall front curl, gold-rimmed
 curlpts=[(side*.10,-.29,.42),(side*.19,-.32,.68),(side*.42,-.22,.81),(side*.50,-.07,.67),(side*.39,-.01,.55)]
 curve('Signature curled forelock',curlpts,hair,.105,12)
 curve('Champagne curl inlay',[(side*.13,-.365,.44),(side*.22,-.37,.68),(side*.41,-.29,.77),(side*.46,-.18,.67)],gold,.022,7)
 # large S waves flowing from crown around shoulders.
 for k in range(2):
  x=side*(.28+k*.17);shift=k*.12
  p=[(x,.00,.46),(side*(.60+shift),-.01,.22),(side*(.69+shift),.02,-.11),(side*(.55+shift),.07,-.40),(side*(.78+shift),.12,-.66),(side*(.91+shift),.12,-.88),(side*(.73+shift),.08,-.93)]
  curve('Long liquid hair ribbon',p,hair,.13-k*.022,12)
  curve('Aqua glass hair edge',[(a+side*.035,b-.11,c-.015) for a,b,c in p[:5]],edge,.018,6)
 # fan ears
 ear=uv('Translucent ear fin',(side*.53,-.02,-.035),(.26,.11,.18),edge);ear.parent=head;ear.rotation_euler[1]=side*.27
 # face, expressive brows, lashes and large eyes
 x=side*.215
 eye=uv('Eye white',(x,-.384,.012),(.157,.072,.177),white);eye.parent=head
 ir=uv('Jewel jade iris',(x+side*.018,-.445,.008),(.101,.046,.125),iris);ir.parent=head
 pu=uv('Glossy pupil',(x+side*.024,-.482,.012),(.051,.027,.085),pupil);pu.parent=head
 catch=uv('Eye sparkle',(x-.01,-.507,.065),(.025,.014,.033),white,24,16);catch.parent=head
 curve('Fine upper lashes',[(x-.145,-.407,-.01),(x-.07,-.426,.142),(x+.02,-.427,.171),(x+.15,-.407,.045)],hair,.014,5).parent=head
 curve('Soft arch brow',[(x-.12,-.36,.252),(x,-.39,.295),(x+.12,-.36,.26)],hair,.018,5).parent=head
 # blush cheek
 cheek=uv('Peach blush',(side*.36,-.36,-.17),(.07,.015,.036),coral,32,20);cheek.parent=head
# nose and smile.
nose=uv('Button nose',(0,-.398,-.095),(.045,.035,.035),skin,32,20);nose.parent=head
curve('Sweet smile',[(-.095,-.408,-.224),(0,-.432,-.254),(.095,-.408,-.224)],gold,.012,6).parent=head
# Small mouth movement with visible smile retained.
mouth=uv('Speaking mouth',(0,-.408,-.238),(.045,.015,.024),pupil,24,16);mouth.parent=head
# Delicate sea-crown with arches and jewel.
curve('Champagne crown',[(-.46,-.26,.37),(-.36,-.35,.51),(-.20,-.39,.45),(0,-.41,.73),(.20,-.39,.45),(.36,-.35,.51),(.46,-.26,.37)],gold,.025,8).parent=head
uv('Crown aqua jewel',(0,-.421,.48),(.055,.022,.08),edge,32,24).parent=head
# flowing arms with palms, cuffs, separated fingers
for side in (-1,1):
 arm=curve('Tide arm',[(side*.36,-.01,.12),(side*.62,-.07,.00),(side*.72,-.14,-.19),(side*.88,-.18,-.24)],skin,.075,12)
 palm=uv('Small palm',(side*.88,-.18,-.24),(.12,.075,.08),skin);palm.parent=root
 for j in range(3):
  dx=(j-1)*.045
  curve('Delicate finger',[(side*.91+dx,-.19,-.24),(side*1.00+dx,-.20,-.22),(side*1.04+dx,-.20,-.17)],skin,.023,6)
 curve('Gold wrist cuff',[(side*.71,-.17,-.16),(side*.76,-.20,-.19),(side*.80,-.21,-.20)],gold,.014,5)
# gold bodice piping, jewelry and pearls
curve('Gold neckline',[(-.32,-.28,.13),(-.22,-.35,-.02),(0,-.37,-.09),(.22,-.35,-.02),(.32,-.28,.13)],gold,.021,6)
curve('Tidelight wave pendant',[(-.11,-.37,-.19),(-.04,-.40,-.13),(.03,-.40,-.20),(.11,-.37,-.14)],edge,.02,6)
for i,(x,z) in enumerate([(-.98,.15),(.94,.54),(-.90,-.48),(.95,-.62)]):uv('Orbiting pearl',(x,.02,z),(.04,.04,.04),edge,24,16)
# parent/detail rig head only rotates; root floats/turns.
for f,z,rx,rz in [(1,0,0,0),(19,.05,-.03,.025),(38,0,0,0),(56,-.04,.03,-.02),(75,0,0,0),(94,.05,-.025,.02),(113,0,0,0),(131,-.04,.025,-.02),(150,0,0,0)]:
 root.location=(0,0,z);root.rotation_euler=(rx,0,rz);root.keyframe_insert('location',frame=f);root.keyframe_insert('rotation_euler',frame=f)
for f,z in [(1,0),(23,.045),(45,-.045),(75,0),(105,.035),(135,-.035),(150,0)]:head.rotation_euler[2]=z;head.keyframe_insert('rotation_euler',frame=f)
# blink by scaling eye assemblies along local z, a fast natural close/reopen.
for o in [q for q in bpy.context.scene.objects if q.name in ('Eye white','Jewel jade iris','Glossy pupil','Eye sparkle')]:
 base=o.scale.copy()
 for f in [1,37,39,41,83,85,87,125,127,129,150]:
  factor=.035 if f in [39,85,127] else 1.0;o.scale=(base.x,base.y,base.z*factor);o.keyframe_insert('scale',frame=f)
for f in range(1,151):
 mouth.hide_render=(f%12 not in (2,3,4,8,9));mouth.keyframe_insert('hide_render',frame=f)
# Both arms provide a gentle asymmetric presenting movement.
for o in [q for q in s.objects if q.name=='Tide arm']:
 side=1 if o.location.x>=0 else -1
 for f,angle in [(1,0),(21,.06*side),(42,-.08*side),(63,.11*side),(84,-.06*side),(105,.09*side),(126,-.05*side),(150,0)]:o.rotation_euler[1]=angle;o.keyframe_insert('rotation_euler',frame=f)
for o in s.objects:
 if o.animation_data and o.animation_data.action:
  for fc in o.animation_data.action.fcurves:
   for k in fc.keyframe_points:k.interpolation='BEZIER'
# soft professional studio lighting
w=bpy.data.worlds.new('Tide lagoon studio');w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.008,.027,.032,1);w.node_tree.nodes['Background'].inputs[1].default_value=.2;s.world=w
for name,loc,power,size,col in [('Soft key',(-3,-4,5),950,4,(.70,1,.91)),('Face fill',(3,-3,1),700,3,(.42,.9,1)),('Lagoon rim',(0,2,3),1600,3,(.18,1,.82)),('Warm gold edge',(-3,1,-.2),700,2,(1,.72,.40))]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.name=name;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.data.color=col;l.rotation_euler=(Vector((0,0,0))-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-8,0));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=5.1;cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();s.camera=cam
s.frame_start=1;s.frame_end=150;s.frame_set(48);s.render.resolution_x=700;s.render.resolution_y=1050;s.cycles.samples=16;s.cycles.use_denoising=False
s.render.filepath=str(ASSET_DIR / 'Tide_Hero_Transparent.png');s.render.engine='BLENDER_EEVEE_NEXT';s.eevee.taa_render_samples=64
bpy.ops.wm.save_as_mainfile(filepath=str(ASSET_DIR / 'Tide_Original_3D_Asset.blend'))
bpy.ops.render.render(write_still=True)
# performance pass
s.render.engine='BLENDER_EEVEE_NEXT';s.eevee.taa_render_samples=16;s.render.resolution_x=540;s.render.resolution_y=810;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.film_transparent=True;s.render.fps=30;s.frame_start=1;s.frame_end=150;s.render.filepath=str(ASSET_DIR / 'renders' / 'tide_anim' / 'frame_')
bpy.ops.wm.save_as_mainfile(filepath=str(ASSET_DIR / 'Tide_Original_3D_Asset.blend'));bpy.ops.render.render(animation=True)
