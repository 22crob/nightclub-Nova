# A rough model of a club played for 40 hours, minute by minute, to check the
# game's pacing: when each level comes, how popularity and the guest limit
# grow, how often the bars need restocking, and where the money goes. It is a
# model (averages, not the real game), used for tuning config.js.
# Run: python3 game/tools/balance_sim.py [name=value ...] to try other numbers.
import math, sys
# --- tunables under test ---
P = dict(danceTipMin=5.25, bonusMin=117, capMax=80, stockPerGuest=0, happy=3, content=1, unhappy=-1, storm=-5, capBase=8, capRoot=1.2, tilesPerGuest=4,
         stockBase=40, stockPerUnit=20, costPerDrink=2,
         lvFirst=200, lvStep=220, lvCurve=30, passiveShare=0.05)
for a in sys.argv[1:]:
    k,v=a.split('='); P[k]=float(v)
def need(l): k=l-1; return P['lvFirst']+P['lvStep']*k+P['lvCurve']*k*k
EXP=[(1,10),(3,11),(5,12),(7,13),(9,14),(11,15),(13,16),(15,17),(17,18),(19,19),(22,20),(25,21),(28,22),(31,23),(34,24),(37,25),(40,26)]
def maxwall(l): return max(s for lv,s in EXP if lv<=l)
xp=0; level=1; into=0; cash=700; pop=0; W=H=10; fanRate=4.9; barUnits=1; bartenders=1
stock=60; restocks=0; price=8; drinksTotal=0
log=[]; t=0; lastLevelT={1:0}
while t < 60*40 and level<40:
    t+=1
    cap=min(P['capMax'], P['capBase']+int(P['capRoot']*math.sqrt(pop)), max(P['capBase'], W*H//P['tilesPerGuest']))
    guests=cap*0.9
    visit=7.0
    leavers=guests/visit
    # drinks per guest-min, limited by bartender throughput (10/min each)
    want=guests*0.48
    maxStock = P['stockBase']+(P['stockPerGuest']*cap if P['stockPerGuest'] else P['stockPerUnit']*barUnits)
    drinks=min(want, bartenders*10, stock)
    stock-=drinks; drinksTotal+=drinks
    if stock < maxStock*0.2:  # player restocks when warned
        cost=(maxStock-stock)*P['costPerDrink']
        if cash>cost: cash-=cost; stock=maxStock; restocks+=1
    happyShare=0.65 if drinks>=want*0.9 else 0.4
    pop+=leavers*(P['happy']*happyShare+P['content']*(0.95-happyShare)+P['unhappy']*0.05)
    # money
    cash+=drinks*price*1.35 + guests*0.3*P['danceTipMin'] + leavers*5 + P['bonusMin']*0.5  # half the dance tips, half the bonuses clicked
    cash-=bartenders*4*2 + 0  # wages per min
    # xp
    g=leavers*1 + drinks*2 + guests*0.3*2 + guests*0.25/1.2*2 + leavers*(3*happyShare+0.3) + guests*0.03*3
    g+=fanRate*P['passiveShare']*60
    xp+=g; into+=g
    while into>=need(level):
        into-=need(level); level+=1; lastLevelT[level]=t
        fanRate+=0.6; price=min(40, 8+level*0.8)
        # buys the level's new things (first-buy XP ~ 6 items x 15)
        spend=min(cash*0.5, 300+level*120); cash-=spend; xp+=90; into+=90
        if level in (5,10,16,23,30): bartenders+=1; barUnits+=1
    # expansion when allowed and affordable
    for side in (0,1):
        cur = W if side==0 else H
        if cur < maxwall(level):
            cost=(cur*(10+(cur+1-11)*6))
            if cash>cost*1.5:
                cash-=cost; xp+=40; into+=40
                if side==0: W+=1
                else: H+=1
    if t%60==0 or t in (5,10,20,30):
        log.append((t, level, int(cash), int(pop), cap, W, H, restocks, int(stock)))
for r in log[:40]: print('min %4d  L%-2d cash %7d pop %5d cap %3d room %dx%d restocks %3d stock %d'%r)
print('level reached times (min):', {k:v for k,v in lastLevelT.items() if k in (2,3,5,8,10,15,20,25,30,40)})
print('drinks/restock ~', round(drinksTotal/max(1,restocks),1), 'restocks/hour', round(restocks/(t/60),1))
