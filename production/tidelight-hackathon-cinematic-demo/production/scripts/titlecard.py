from PIL import Image,ImageDraw,ImageFont,ImageFilter
import math,random
from pathlib import Path
W,H=1920,1080
random.seed(19)
for mode in ['open','close']:
 im=Image.new('RGB',(W,H));pix=im.load()
 # deep lagoon gradient
 for y in range(H):
  for x in range(W):
   r=math.sqrt(((x-1270)/1500)**2+((y-400)/1000)**2); glow=max(0,1-r)
   pix[x,y]=(int(5+4*glow),int(19+31*glow),int(22+28*glow))
 # radial soft lights
 glow=Image.new('RGBA',(W,H),(0,0,0,0));g=ImageDraw.Draw(glow)
 g.ellipse((950,-150,1950,850),fill=(24,142,112,42));glow=glow.filter(ImageFilter.GaussianBlur(180));im=Image.alpha_composite(im.convert('RGBA'),glow)
 d=ImageDraw.Draw(im)
 mono='/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf';reg='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
 d.text((112,88),'TIDELIGHT   /   MARKET INTELLIGENCE',font=ImageFont.truetype(mono,19),fill=(157,225,200,255))
 d.rounded_rectangle((111,133,454,137),radius=2,fill=(93,227,184,220))
 if mode=='open':
  d.text((108,303),'EVENT → EVIDENCE',font=ImageFont.truetype(bold,50),fill=(237,247,239,255))
  d.text((108,377),'EXPOSURE → SCENARIO',font=ImageFont.truetype(bold,50),fill=(117,228,190,255))
  d.text((108,451),'DECISION',font=ImageFont.truetype(bold,50),fill=(237,247,239,255))
  d.text((112,580),'The story moves after hours.',font=ImageFont.truetype(reg,29),fill=(179,201,191,255))
  d.text((112,642),'Follow the evidence. Keep your bearings.',font=ImageFont.truetype(reg,24),fill=(146,182,168,255))
 else:
  d.text((108,342),'SEE THE SIGNAL',font=ImageFont.truetype(bold,62),fill=(242,249,243,255))
  d.text((108,422),'BETWEEN SESSIONS.',font=ImageFont.truetype(bold,62),fill=(117,228,190,255))
  d.text((112,550),'Read the story. Check the evidence.',font=ImageFont.truetype(reg,27),fill=(179,201,191,255))
  d.text((112,606),'Let the decision remain yours.',font=ImageFont.truetype(reg,27),fill=(179,201,191,255))
 # elegant concentric orbital rings behind Tide
 cx,cy=1480,500
 for rad,alpha in [(330,30),(270,38),(210,48)]:
  d.ellipse((cx-rad,cy-rad,cx+rad,cy+rad),outline=(94,218,176,alpha),width=2)
 # fine wave lines
 for j in range(3):
  pts=[]
  for x in range(-20,W+40,12):
   y=870+j*36+22*math.sin(x/195+j*.75)+8*math.sin(x/89-j)
   pts.append((x,y))
  d.line(pts,fill=(84,205,172,95-j*18),width=3)
 # particles
 for i in range(90):
  x=random.randint(70,W-70);y=random.randint(140,890);r=random.choice([1,2,2,3]);d.ellipse((x-r,y-r,x+r,y+r),fill=(152,250,214,random.randint(70,175)))
 d.text((112,970),'TIDELIGHT  •  PUBLIC DESKTOP DEMONSTRATION',font=ImageFont.truetype(mono,15),fill=(109,152,138,255))
 im.convert('RGB').save(Path(__file__).resolve().parents[1] / 'clips' / f'{mode}_card.png')
