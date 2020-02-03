const canvas = document.getElementById('Game-Box');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const {width, height} = canvas;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;

const tileSize = 48;
const GRAVITY = 1.4;

const Time = {
	millis: {
		last: (new Date()).getTime(),
		now: 0,
 		inter: 0,
	 	total: 0,
		update: function()
		{
			const saved = (new Date()).getTime();
			this.inter = saved - this.last;
			this.now += this.inter;
			this.total += this.inter;
			this.last = saved;
		},
	},
	get second()
	{
		return Math.floor(this.millis.now / 1000);
	},
	set second(x)
	{
		this.millis.now = x * 1000;
	},
	minute: 0,
	hour: 0,
	get clock()
	{
		return (
			('0' + this.hour).slice(-2) + ':' +
			('0' + this.minute).slice(-2) + ':' +
			('0' + this.second.slice(-2)));
	},
};

class Vec {
	constructor(x = 0, y = 0)
	{
		this.x = x;
		this.y = y;
	}
	get mag()
	{
		return Math.sqrt(this.x ** 2 + this.y ** 2);
	}
	set mag(x)
	{
		this.normalize();
		this.x *= x;
		this.y *= x;
	}
	get norm()
	{
		return {
			x: this.x / this.mag,
			y: this.y / this.mag,
		};
	}
	normalize()
	{
		const mag = this.mag;
		if (mag > 0)
		{
			this.x /= mag;
			this.y /= mag;
		}
		else throw Error("Can't normalize zero-length vector.");
	}
	add(vec)
	{
		this.x += vec.x;
		this.y += vec.y;
	}
	sub(vec)
	{
		this.x -= vec.x;
		this.y -= vec.y;
	}
	mult(vec)
	{
		this.x *= vec.x;
		this.y *= vec.y;
	}
	div(vec)
	{
		this.x /= vec.x;
		this.y /= vec.y;
	}
	dist(x, y)
	{
		return Math.sqrt((this.x - x ) ** 2 + (this.y - y) ** 2);
	}
	dot(vec)
	{
		return this.x * vec.x + this.y * vec.y;
	}
	cross(vec)
	{
		return this.x * vec.y - vec.x * this.y;
	}
}


/**************************
 *                        *
 *       COLLISION:       *
 *                        *
 **************************/
const BRect = (x, y, w, h) => ({
	x: x,
	y: y,
	h: h,
	w: w,
});

const SLine = (x1, y1, x2, y2) => ({
	a: new Vec(x1, y1),
	b: new Vec(x2, y2),
});
const VecMath = {
	add: function(v1, v2)
	{
		return new Vec(v1.x + v2.x, v1.y + v2.y);
	},
	sub: function(v1, v2)
	{
		return new Vec(v1.x - v2.x, v1.y - v2.y);
	},
	mult: function(v1, v2)
	{
		return new Vec(v1.x * v2.x, v1.y * v2.y);
	},
	random: function()
	{
		const v = new Vec(Math.random(), Math.random());
		v.normalize();
		return v;
	},
};

{
	// An adaption of these solutions for solving line-to-line intersection:
	// https://stackoverflow.com/a/16725715/11612001
	// https://stackoverflow.com/a/28866825/11612001
	
	const CCW = (p1, p2, p3) =>
		(p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
	
	// This use of var and brace scoping is intentional.
	
	var intersect = (l1, l2) =>
		CCW(l1.a, l2.a, l2.b) !== CCW(l1.b, l2.a, l2.b) &&
		CCW(l1.a, l1.b, l2.a) !== CCW(l1.a, l1.b, l2.b)
}

const AABB = (a, b) => (
	a.x + a.w > b.x &&
	a.y + a.h > b.y &&
	a.x < b.x + b.w &&
	a.y < b.y + b.h);
	
const edges = rect => ({
	'left': SLine(rect.x, rect.y, rect.x, rect.y + rect.h),
	'right': SLine(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h),
	'top':  SLine(rect.x, rect.y, rect.x + rect.w, rect.y),
	'bottom': SLine(rect.x, rect.y + rect.h, rect.x + rect.w, rect.y + rect.h),
});
const lAABB = (a, b) =>
{
  if (pointBox(a.a, b) || pointBox(a.b, b))
    return true;
  const box = edges(b);
  for (const side in box)
  {
    if (intersect(a, box[side]))
      return true;
  }
  return false;
};

// Jame's Hallidan's point-in-polygon algorithm
// https://github.com/substack/point-in-polygon
const isInPolygon = (x, y, poly) =>
{
    var isIn = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
    {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        if ((yi > y) !== (yj > y) &&
            x < (xj - xi) * (y - yi) / (yj - yi) + xi)
        {
            isIn = !isIn;
        }
    }
    return isIn;
};

const pointBox = (a, b) => (
	b.x && b.y && b.w && b.h &&
	a.x > b.x &&
	a.y > b.y &&
	a.x < b.x + b.w &&
	a.y < b.y + b.h);

/**************************
 *                        *
 *        ENTITIES:       *
 *                        *
 **************************/

const borrow = (obj, properties, except) =>
{
	for (const key in properties)
	{
		if (obj.hasOwnProperty(key))
			continue;
		let hasException = false;
		for (const e of except.split(','))
		{
			if (key === e)
			{
				hasException = true;
				break;
			}
		}
		if (hasException)
			continue;
		obj[key] = properties[key];
	}
};
class Entity {
	constructor(properties, repo)
	{
		this.exist = true;
		for (const key in properties)
		{
			this[key] = properties[key];
		}
		this.x = (properties.x || 1);
		this.y = (properties.y || 1);
		this.id = (properties.id || 'Entity');
		this.width = (properties.width || 1);
		this.height = (properties.height || 1);
		for (const mixin of this.mixins)
		{
			borrow(this, repo[mixin], 'init');
			if (repo[mixin].init)
			{
				repo[mixin].init.call(this, properties);
			}
		}
	}
	hasMixin(mixin)
	{
		for (const mix of this.mixins)
		{
			if (mix === mixin)
				return true;
		}
		return false;
	}
}
const scripts = {
	'RigidBody': {
		init: function({ mass })
		{
			this.mass = (mass || 1);
			this.px = this.x;
			this.py = this.y;
			this.vel = new Vec();
			this.acc = new Vec();
			this.facing = 'right';
			this.flags = {
				jumping: false,
				falling: false,
				crouching: false,
				grounded: false,
				onSlope: false,
				onLedge: false,
				attacking: false,
				blocked: false,
				dead: false,
				dying: false,
			};
		},
		updatePhysics: function()
		{
			this.px = this.x;
			this.py = this.y;
			this.vel.add(this.acc);
			this.vel.x *= 0.9;
			this.vel.y *= 0.9;
			if (this.flags.onLedge)
			{
				this.vel.x = 0;
				this.vel.y = 0;
			}
			this.y += this.vel.y;
			this.x += this.vel.x;
			this.flags.grounded = false;
			this.flags.onSlope = false;
			this.flags.blocked = false;
			this.acc.x = 0;
			this.acc.y = 0;
		},
	},
	'Collider': {
		init: function({})
		{
			Object.defineProperty(this, 'hitBox', {
				get: function()
				{
					return BRect(
						this.x - this.width / 2,
						this.y - this.height / 2,
						this.width,
						this.height
					);
				},
			});
			Object.defineProperty(this, 'area', {
				get: function()
				{
					return [
						new Vec(this.hitBox.x, this.hitBox.y),
						new Vec(this.hitBox.x, this.hitBox.y + this.hitBox.h),
						new Vec(this.hitBox.x + this.hitBox.w, this.hitBox.y + this.hitBox.h),
						new Vec(this.hitBox.x + this.hitBox.w, this.hitBox.y),
					];
				},
			});
			Object.defineProperty(this, 'hitLines', {
				get: function()
				{
					return {
						hori: SLine(
							this.x - this.width / 2, this.y,
							this.x + this.width / 2, this.y),
						vert: SLine(
							this.x, this.y - this.height / 2,
							this.x, this.y + this.height / 2),
					};
				},
			});
		},
		collideMap: function(id)
		{
			for (const body of bodies)
			{
				if (!body.id || body.id !== id)
					continue;
				
				if (body !== this && body.collide)
				{
					body.collide(this);
				}
			}
		},
	},
	'Green-Slime': {
		init: function({})
		{
			this.speed = 0.5;
			this.max = 2;
			this.mass = 100;
		},
		takeHit: function()
		{
			this.flags.dead = true;
		},
		display: function()
		{
			if (!Camera.sees(this.hitBox.x, this.hitBox.y, this.hitBox.w, this.hitBox.h))
				return;
			
			if (this.vel.x < 0)
				this.facing = 'left';
			else if (this.vel.x > 0)
				this.facing = 'right';
			
			if (Math.abs(this.vel.x) > this.max)
			{
				this.vel.x /= Math.abs(this.vel.x);
				this.vel.x *= this.max; 
			}
			this.acc.y += GRAVITY;
			if (!this.flags.dying)
			{
				this.updatePhysics();
				this.collideMap('slope');
				this.collideMap('one-way');
				this.collideMap('block');
			}
			this.flags.onLedge = false;
			if (this.flags.blocked)
			{
				this.speed *= -1;
			}
			this.vel.x += this.speed;
			if (Math.abs(this.vel.x) > this.max)
			{
				this.vel.x /= Math.abs(this.vel.x);
				this.vel.x *= this.max; 
			}
			
			ctx.strokeStyle = 'magenta';
			ctx.beginPath();
			ctx.moveTo(this.px, this.py - this.height / 2);
			ctx.lineTo(this.px, this.py + this.height / 2);
			ctx.stroke();
			ctx.strokeStyle = 'yellow';
			ctx.beginPath();
			ctx.moveTo(this.hitLines.hori.a.x, this.hitLines.hori.a.y);
			ctx.lineTo(this.hitLines.hori.b.x, this.hitLines.hori.b.y);
			ctx.stroke();
			ctx.strokeStyle = 'cyan';
			ctx.beginPath();
			ctx.moveTo(this.hitLines.vert.a.x, this.hitLines.vert.a.y);
			ctx.lineTo(this.hitLines.vert.b.x, this.hitLines.vert.b.y);
			ctx.stroke();
			ctx.save();
			ctx.translate(this.x, this.y);
			if (this.facing === 'right')
				ctx.scale(-1, 1);
			
			ctx.strokeStyle = '#60F080';
			ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
			if (this.flags.attacking)
			{
				this.weapon.draw();
			}
			ctx.restore();
		},
	},
	'Blue-Slime': {
		init: function({})
		{
			this.speed = 0.5;
			this.max = 2;
			this.mass = 100;
			Object.defineProperty(this, 'edgeScan', {
				get: function()
				{
					let point = new Vec(this.x, this.y + this.height / 2);
					if (this.facing === 'left')
					{
						point.x = this.x - this.width / 2;
					}
					else
					{
						point.x = this.x + this.width / 2;
					}
					let hit = false;
					while (!hit)
					{
						if (point.y > this.y + this.height / 2 + 10)
						{
							hit = true;
							break;
						}
						for (const body of bodies)
						{
							if (body === this || !body.area) 
								continue;
								
							if (isInPolygon(point.x, point.y, body.area))
							{
								hit = true;
								break;
							}
						}
						++point.y;
					}
					return point.y - (this.y + this.height / 2);
				},
			});
		},
		takeHit: function()
		{
			this.flags.dead = true;
		},
		display: function()
		{
			if (!Camera.sees(this.hitBox.x, this.hitBox.y, this.hitBox.w, this.hitBox.h))
				return;
			
			if (this.vel.x < 0)
				this.facing = 'left';
			else if (this.vel.x > 0)
				this.facing = 'right';
			
			if (Math.abs(this.vel.x) > this.max)
			{
				this.vel.x /= Math.abs(this.vel.x);
				this.vel.x *= this.max; 
			}
			this.acc.y += GRAVITY;
			if (!this.flags.dying)
			{
				this.updatePhysics();
				this.collideMap('slope');
				this.collideMap('one-way');
				this.collideMap('block');
			}
			this.flags.onLedge = false;
			if (this.edgeScan > 4 && this.flags.grounded)
			{
				this.flags.blocked = true;
			}
			if (this.flags.blocked)
			{
				this.speed *= -1;
			}
			this.vel.x += this.speed;
			
			if (Math.abs(this.vel.x) > this.max)
			{
				this.vel.x /= Math.abs(this.vel.x);
				this.vel.x *= this.max; 
			}
			
			ctx.strokeStyle = 'magenta';
			ctx.beginPath();
			ctx.moveTo(this.px, this.py - this.height / 2);
			ctx.lineTo(this.px, this.py + this.height / 2);
			ctx.stroke();
			ctx.strokeStyle = 'yellow';
			ctx.beginPath();
			ctx.moveTo(this.hitLines.hori.a.x, this.hitLines.hori.a.y);
			ctx.lineTo(this.hitLines.hori.b.x, this.hitLines.hori.b.y);
			ctx.stroke();
			ctx.strokeStyle = 'cyan';
			ctx.beginPath();
			ctx.moveTo(this.hitLines.vert.a.x, this.hitLines.vert.a.y);
			ctx.lineTo(this.hitLines.vert.b.x, this.hitLines.vert.b.y);
			ctx.stroke();
			ctx.save();
			ctx.translate(this.x, this.y);
			if (this.facing === 'right')
				ctx.scale(-1, 1);
			ctx.strokeStyle = '#2060F0';
			ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
			if (this.flags.attacking)
			{
				this.weapon.draw();
			}
			ctx.restore();
		},	
	},
	'Player': {
		init: function({})
		{
			this.NORM_HEIGHT = this.height;
			this.DUCK_HEIGHT = this.height * 0.67;
			this.speed = 1;
			this.max = 4;
			this.running = false;
			this.mass = 100;
			this.jump = {
				pressed: false,
				force: 6,
				maxForce: 6,
				damp: 0.95,
			};
			this.weapon = {
				id: 'Gun',
				hit: false,
				ray: SLine(0, 0, 0, 0),
				holder: null,
				margin: 0,
				hits: 0,
				RPM: 600,
				timer: 0,
				draw: function() {},
				attack: function()
				{
					this.holder.flags.attacking = true;
					this.timer += Time.millis.inter;
					if (this.timer < this.RPM / 6)
						return;
					
					++this.hits;
					this.hit = false;
					this.margin = -0.01 + Math.random() * 0.02;
					if (this.holder.facing === 'right')
					{
						this.ray.a = new Vec(
							this.holder.x + this.holder.width / 2,
							this.holder.y - this.holder.height * 0.1);
						this.ray.b = new Vec(
							this.holder.x + this.holder.width / 2,
							this.holder.y - this.holder.height * 0.1);
					}
					else
					{
						this.ray.a = new Vec(this.holder.x - (this.holder.width / 2), this.holder.y);
						this.ray.b = new Vec(this.holder.x - (this.holder.width / 2), this.holder.y);
					}
					while (!this.hit)
					{
						if (this.holder.facing === 'right')
						{
							++this.ray.b.x;
						}
						else
						{
							--this.ray.b.x;
						}
						this.ray.b.y += this.margin;
						if (!Camera.sees(this.ray.b.x, this.ray.b.y, 0, 0))
						{
							this.hit = true;
						}
						for (const body of bodies)
						{
							if (body === this.holder || !body.area)
								continue;
							
							if (isInPolygon(this.ray.b.x, this.ray.b.y, body.area))
							{
								this.hit = true;
								if (body.takeHit)
								{
									body.takeHit();
								}
							}
						}
					}
					ctx.strokeStyle = '#C8E020';
					ctx.beginPath();
					ctx.moveTo(this.ray.a.x, this.ray.a.y);
					ctx.lineTo(this.ray.b.x, this.ray.b.y);
					ctx.stroke();
					this.timer = 0;
				},
			};
			this.weapon.holder = this;
		},
		display: function()
		{
			if (this.flags.grounded)
			{
				if (!this.running)
				{
					this.speed = 0.75;
					this.max = 3;
				}
				else
				{
					this.speed = 1;
					this.max = 5;
				}
			}
			else
			{
				this.speed = 0.6;
			}
			if (controls['main'].pos.y >= meter * 0.4)
			{
				this.flags.crouching = true;
				this.flags.jumping = false;
			}
			else
			{
				this.flags.crouching = false;
			}
			if (Math.abs(controls['main'].pos.x) > controls['main'].outer / 2.5)
			{
				this.acc.x += this.speed * (controls['main'].pos.x / Math.abs(controls['main'].pos.x));
				
				if (!this.flags.onLedge)
				{
					if (controls['main'].pos.x > 0)
						this.facing = 'right';
					if (controls['main'].pos.x < 0)
						this.facing = 'left';
				}
			}
			if (this.flags.crouching || this.flags.jumping)
			{
				this.flags.onLedge = false;
			}
			this.acc.y += GRAVITY;
			if (inputs['A'])
			{
				if ((this.flags.grounded || this.flags.onLedge) &&
				    !this.flags.crouching && !this.jump.pressed)
				{
					this.flags.jumping = true;
					this.flags.onLedge = false;
					this.jump.pressed = true;
				}
			}
			else if (this.flags.grounded || this.flags.onLedge)
			{
				this.jump.pressed = false;
			}
			if (!this.flags.jumping)
			{
				this.jump.force = this.jump.maxForce;
			}
			else
			{
				if (inputs['A'] && this.jump.force > GRAVITY)
				{
					this.vel.y -= this.jump.force;
					this.jump.force *= this.jump.damp;
				}
				else
				{
					this.flags.jumping = false;
				}
			}
			if (this.flags.crouching)
			{
				this.height = this.DUCK_HEIGHT;
			}
			else
			{
				if (this.height === this.DUCK_HEIGHT)
					this.y -= (this.NORM_HEIGHT - this.DUCK_HEIGHT) / 2;
				this.height = this.NORM_HEIGHT;
			}
			if (!this.flags.dying)
			{
				this.updatePhysics();
				this.collideMap('slope');
				this.collideMap('one-way');
				this.collideMap('block');
			}
			
			this.flags.falling = !Boolean(
				this.flags.grounded ||
				this.flags.jumping  ||
				this.flags.onLedge);
				
			this.running = Boolean(inputs['B']);
			
			if (inputs['B'] && Math.abs(this.vel.x) < 1  &&
			    !this.flags.onLedge)
			{
				this.weapon.attack();
			}
			else
			{
				this.weapon.timer = this.weapon.RPM / 6;
				this.flags.attacking = false;
			}
			if (Math.abs(this.vel.x) > this.max)
			{
				this.vel.x /= Math.abs(this.vel.x);
				this.vel.x *= this.max; 
			}
			
			
			ctx.strokeStyle = 'magenta';
			ctx.beginPath();
			ctx.moveTo(this.px, this.py - this.height / 2);
			ctx.lineTo(this.px, this.py + this.height / 2);
			ctx.stroke();
			ctx.strokeStyle = 'yellow';
			ctx.beginPath();
			ctx.moveTo(this.hitLines.hori.a.x, this.hitLines.hori.a.y);
			ctx.lineTo(this.hitLines.hori.b.x, this.hitLines.hori.b.y);
			ctx.stroke();
			ctx.strokeStyle = 'cyan';
			ctx.beginPath();
			ctx.moveTo(this.hitLines.vert.a.x, this.hitLines.vert.a.y);
			ctx.lineTo(this.hitLines.vert.b.x, this.hitLines.vert.b.y);
			ctx.stroke();
			ctx.save();
			ctx.translate(this.x, this.y);
			if (this.facing === 'right')
				ctx.scale(-1, 1);
				
			ctx.strokeStyle = 'white';
			ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
			if (this.flags.attacking)
			{
				this.weapon.draw();
			}
			ctx.restore();
		},
	},
};

const bodies = [];
const prefabs = {
	'Player': {
		id: 'player',
		mass: 100,
		width: tileSize * 0.65,
		height: tileSize * 1.2,
		mixins: ['RigidBody', 'Collider', 'Player'],
	},
	'GreenSlime': {
		id: 'Slime',
		mass: 100,
		width: tileSize * 0.75,
		height: tileSize * 0.65,
		mixins: ['RigidBody', 'Collider', 'Green-Slime'],
	},
	'BlueSlime': {
		id: 'Slime',
		mass: 100,
		width: tileSize * 0.75,
		height: tileSize * 0.65,
		mixins: ['RigidBody', 'Collider', 'Blue-Slime'],
	},
};
const addEntity = (entity, x, y, w, h) =>
{
	const ent = new Entity(prefabs[entity], scripts);
	ent.x = x;
	ent.y = y;
	ent.w = w;
	ent.h = h;
	bodies.push(ent);
};
const Player = new Entity(prefabs['Player'], scripts);

// Arbitrary unit of scale:
let meter = width / 8;
if (width > height)
{
	meter = height / 6;
}


/**************************
 *                        *
 *         LEVELS:        *
 *                        *
 **************************/
let level = 0;
const levels = [
	Object.freeze({
		w: 120,
		h: 100,
		tiles: [
			['block', 0, 99, 120, 1, true],
			['slope', 8, 95, -4, 4, true],
			['block', 12, 95, 5, 2, true],
			['block', 17, 95, 3, 2],
			['block', 12, 97, 1, 2],
			['slope', 16, 91, -4, 4, true],
			['block', 20, 91, 1, 6, true],
			['one-way', 21, 95, 2],
			['block', 23, 91, 1, 8, true],
			['slope', 24, 91, 2, 8],
			['block', 30, 93, 10, 2, true],
			['block', 30, 95, 6, 4],
			['slope', 42, 92, -8, -4],
			['block', 42, 91, 8, 1, true],
			['block', 50, 91, 1, 5, true],
			['one-way', 53, 94, 8],
			['rope', 63, 91, -8, 8],
			['block', 71, 91, 1, 8, true],
			['block', 72, 95, 1, 4, true],
			['slope', 73, 97, 4, 2, true],
			['block', 80, 96, 2, 3],
			['slope', 80, 95, -1, 1],
			['slope', 81, 95, 1, 1],
			
		//	['block', 91, 96, 3, 3],
			['block', 90, 97, 5, 2],
			['block', 93, 95, 2, 2],
			['slope', 88, 97, -2, 2],
			['slope', 90, 95, -3, 2],
			['slope', 93, 94, -1, 1],
			['slope', 94, 94, 5, 4],
			['slope', 99, 98, 4, 1],
			['rope', 72, 91, 38, 0],
			['block', 110, 91, 1, 8, true],
			['block', 111, 92, 2, 3, true],
			['block', 111, 95, 4, 2, true],
			['block', 111, 97, 6, 2, true],
			['block', 119, 98, 1, 1, true],
		],
		things: [
			['green-slime', 30, 93],
			['blue-slime', 42, 88],
		],
		player: [1, 99],
	}),
];

const loadLevel = lev =>
{
	while (bodies.length > 0)
		bodies.splice(0, 1);
	
	const map = levels[lev].tiles;
	for (let i = 0; i < map.length; ++i)
	{
		switch (map[i][0].toLowerCase())
		{
			case 'block':
			{
				const w = map[i][3] * tileSize;
				const h = map[i][4] * tileSize;
				const x = map[i][1] * tileSize + w / 2;
				const y = map[i][2] * tileSize + h / 2;
				const hasTop = (map[i][5] || false);
				bodies.push(new Block(x, y, w, h, hasTop));
				break;
			}
			case 'slope':
			{
				const w = map[i][3] * tileSize;
				const h = map[i][4] * tileSize;
				const x = map[i][1] * tileSize + (w / 2 * (w / Math.abs(w)));
				const y = map[i][2] * tileSize + (h / 2 * (h / Math.abs(h)));
				const hasTop = (map[i][5] || false);
				bodies.push(new Slope(x, y, w, h, hasTop));
				break;
			}
			case 'one-way':
			{
				const w	 = map[i][3] * tileSize;
				const x = map[i][1] * tileSize + w / 2;
				const y = map[i][2] * tileSize;
				bodies.push(new OneWay(x, y, w));
				break;
		 }
			case 'rope':
			{
				const w = (map[i][3] * tileSize);
				const h = (map[i][4] * tileSize);
				const x = Math.abs(w) !== 0 ?
					map[i][1] * tileSize + (w / 2 * (w / Math.abs(w)))
					: map[i][1] * tileSize;
				const y = Math.abs(h) !== 0 ?
					map[i][2] * tileSize + (h / 2 * (h / Math.abs(h)))
					: map[i][2] * tileSize;
				bodies.push(new Rope(x, y, w, h));
				break;
			}
		}
	}
	const things = levels[lev].things;
	for (let i = 0; i < things.length; ++i)
	{
		switch(things[i][0].toLowerCase())
		{
			case 'green-slime':
			{
				const w = tileSize / 2;
				const h = tileSize / 2;
				const x = things[i][1] * tileSize + w / 2;
				const y = things[i][2] * tileSize - h / 2;
				addEntity('GreenSlime', x, y, w, h);
				break;
			}
			case 'blue-slime':
			{
				const w = tileSize / 2;
				const h = tileSize / 2;
				const x = things[i][1] * tileSize + w / 2;
				const y = things[i][2] * tileSize - h / 2;
				addEntity('BlueSlime', x, y, w, h);
				break;
			}
		}
	}
	Player.w = tileSize / 2;
	Player.h = tileSize
	Player.x = levels[lev].player[0] * tileSize + Player.w / 2;
	Player.y = levels[lev].player[1] * tileSize - Player.h / 2;
	bodies.push(Player);
};

/**************************
 *                        *
 *  TOUCHSCREEN SUPPORT:  *
 *                        *
 **************************/
const touches = new Array(10);
for (let i = 0; i < touches.length; ++i)
{
	touches[i] = {
		x: 0,
		y: 0,
		pressed: false,
	};
}

const handleTouch = e => {
	e.preventDefault();
	const box = canvas.getBoundingClientRect();
	for (let i = e.touches.length - 1; i >= 0; --i)
	{
		const touch = e.touches[i];
		if (i >= touches.length)
			continue;
			
		const p = touch.identifier;
		const x = touch.pageX;
		const y = touch.pageY;
		touches[p].x = Math.round((x - box.left) / (box.right - box.left) * canvas.width);
		touches[p].y = Math.round((y - box.top) / (box.bottom - box.top) * canvas.height);
		
		touches[p].pressed = (
			x > box.left &&
			y > box.top &&
			x < box.right &&
			y < box.bottom);
	}
};
const findTouch = (e, id) =>
{
	for (const touch of e.touches)
	{
		if (touch.identifier === id)
			return true;
	}
	return false;
};
canvas.addEventListener('touchstart', handleTouch);
canvas.addEventListener('touchmove', handleTouch);
canvas.addEventListener('touchend', e =>
{
	for (let i = 0; i < touches.length; ++i)
	{
		if (!findTouch(e, i))
			touches[i].pressed = false;
	}
});

const inputs = {
};
class JoyStick {
	constructor(x = width / 2, y = height / 2)
	{
		this.origin = new Vec(x, y);
		this.pos = new Vec(0, 0);
		this.pointer = -1;
		this.inner = meter / 2;
		this.outer = meter;
	}
	draw()
	{
		ctx.fillStyle = 'white';
		ctx.strokeStyle = 'white';
		ctx.globalAlpha = 0.25;
		ctx.beginPath();
		ctx.arc(this.origin.x, this.origin.y, this.outer, this.outer, 0, Math.PI * 2);
		ctx.closePath();
		ctx.fill();
		ctx.globalAlpha = 0.5;
		ctx.lineWidth = meter / 50;
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(this.origin.x + this.pos.x, this.origin.y + this.pos.y, this.inner, this.inner, 0, Math.PI * 2);
		ctx.closePath();
		ctx.fill();
		
		if (this.pointer >= 0)
		{
			let pointer = new Vec(
				touches[this.pointer].x,
				touches[this.pointer].y);
				
			pointer.sub(this.origin);
			if (pointer.mag > this.outer - this.inner)
				pointer.mag = this.outer - this.inner;
			
			this.pos.x = Math.round(pointer.x);
			this.pos.y = Math.round(pointer.y);
			if (!touches[this.pointer].pressed)
			{
				this.pointer = -1;
			}
		}
		else
		{
			this.pos.x = 0;
			this.pos.y = 0;
			for (let i = 0; i < touches.length; ++i)
			{
				if (touches[i].pressed && this.origin.dist(touches[i].x, touches[i].y) <= this.outer)
				{
					this.pointer = i;
					break;
				}
			}
		}
		ctx.globalAlpha = 1;
	}
}
class ClickButton {
	constructor(
		input = 'A', x = width / 2, y = height / 2)
	{
		this.input = input;
		inputs[this.input] = false;
		this.pos = new Vec(x, y);
		this.pointer = -1;
	}
	draw()
	{
		const size = meter / 2;
		ctx.fillStyle = 'white';
		ctx.strokeStyle = 'white';
		ctx.globalAlpha = 0.25;
		ctx.beginPath();
		ctx.arc(this.pos.x, this.pos.y, size, size, 0, Math.PI * 2);
		ctx.closePath();
		ctx.fill();
		ctx.globalAlpha = 0.5;
		ctx.lineWidth = meter / 50;
		ctx.stroke();
		if (this.pointer >= 0)
		{
			ctx.beginPath();
			ctx.arc(this.pos.x, this.pos.y, size * 0.9, size * 0.9, 0, Math.PI * 2);
			ctx.closePath();
			ctx.fill();
			inputs[this.input] = true;
			if (!touches[this.pointer].pressed)
			{
				this.pointer = -1;
			}
		}
		else
		{
			inputs[this.input] = false;
			for (let i = 0; i < touches.length; ++i)
			{
				if (touches[i].pressed && this.pos.dist(touches[i].x, touches[i].y) <= size)
				{
					this.pointer = i;
					break;
				}
			}
		}
		ctx.globalAlpha = 1;
	};
};
const controls = {
	'main': new JoyStick(meter * 1.5, height - meter * 1.5),
	'A': new ClickButton('A', width - meter * 1.5, height - meter * 1.5),
	'B': new ClickButton('B', width - meter * 3, height - meter * 1.5),
};


/**************************
 *                        *
 *       2D CAMERA:       *
 *                        *
 **************************/
const Camera = {
	x: width / 2,
	y: height / 2,
	get bounds()
	{
		return BRect(0, 0, levels[level].w * tileSize, levels[level].h * tileSize);
	},
	free: false,
	outOfBounds: function(target)
	{
		if (!this.bounds)
			return false;
		const x = (
			(target.x - width / 2 < this.bounds.x ||
			target.x + width / 2  > this.bounds.x + this.bounds.w) &&
			!this.free);
		const y = (
			(target.y - height / 2 < this.bounds.y ||
			target.y + height / 2 > this.bounds.y + this.bounds.h) &&
			!this.free);
		return {x: x, y: y};
	},
	constrainX: function(target)
	{
		if (target.x + target.width / 2 > this.x + width / 2)
		{
			target.flags.blocked = true;
			target.x = this.x + width / 2 - target.width / 2;
		}
		if (target.x - target.width / 2 < this.x - width / 2)
		{
			target.flags.blocked = true;
			target.x = this.x - width / 2 + target.width / 2;
		}
	},
	track: function(target)
	{
		if (!this.outOfBounds(target).x)
		{
			this.x = target.x;
		}
		else
		{
			if (target.x - width / 2 < this.bounds.x)
			{
				this.x = this.bounds.x + width / 2;
			}
			else
			{
				this.x = this.bounds.x + this.bounds.w - width / 2;
			}
		}
		if (!this.outOfBounds(target).y)
		{
			this.y = target.y;
		}
		else
		{
			if (target.y - height / 2 < this.bounds.y)
			{
				this.y = this.bounds.y + height / 2;
			}
			else
			{
				this.y = this.bounds.y + this.bounds.h - height / 2;
			}
		}
	},
	sees: function(x, y, w, h)
	{
		return (
			x + w>= this.x - canvas.width / 2 &&
			y + h >= this.y - canvas.height / 2 &&
			x <= this.x + canvas.width / 2 &&
			y <= this.y + canvas.height / 2);
	},
};

/**************************
 *                        *
 *       PLATFORMS:       *
 *                        *
 **************************/
class Block {
	constructor(x, y, w, h, hasTop = true)
	{
		this.x = x;
		this.y = y;
		this.width = w;
		this.height = h;
		this.hasTop = hasTop;
		this.id = 'block';
	}
	get hitBox()
	{
		return BRect(
			this.x - this.width / 2,
			this.y - this.height / 2,
			this.width,
			this.height);
	}
	get area()
	{
		return [
			new Vec(this.hitBox.x, this.hitBox.y),
			new Vec(this.hitBox.x, this.hitBox.y + this.hitBox.h),
			new Vec(this.hitBox.x + this.hitBox.w, this.hitBox.y + this.hitBox.h),
			new Vec(this.hitBox.x + this.hitBox.w, this.hitBox.y),
			];
	}
	wasGrabbedBy(that)
	{
		if (!that.hitLines.hori)
			return false;
		
		const prev = SLine(
			that.hitLines.hori.a.x + (that.px - that.x),
			that.hitLines.hori.a.y + (that.py - that.y),
			that.hitLines.hori.b.x + (that.px - that.x),
			that.hitLines.hori.b.y + (that.py - that.y));
		if (that.flags.onSlope || that.flags.grounded)
			return false;
		
		if (!lAABB(that.hitLines.hori, this.hitBox) || lAABB(prev, this.hitBox))
			return false;
		
		if (that.flags.crouching || that.py > that.y)
			return false;
		
		for (const body of bodies)
		{
			if (body === that || !body.hitBox)
				continue;
			
			if (AABB(that.hitBox, body.hitBox) && that.hitLines.hori.a.y - 8 > body.hitBox.y)
				return false;
		}
		return true;
	}
	collide(that)
	{
		if (!that.hitBox)
			return;
		
		if (!AABB(this.hitBox, that.hitBox))
			return;
		
		if (this.wasGrabbedBy(that))
		{
			that.flags.onLedge = true;
		}
		if (that.flags.onSlope && lAABB(that.hitLines.hori, this.hitBox))
		{
			if (that.x > this.x)
			{
				while (lAABB(that.hitLines.hori, this.hitBox))
				{
					++that.x
				}
			} else {
				while (lAABB(that.hitLines.hori, this.hitBox))
				{
					--that.x
				}
			}
		}
		const overlap = new Vec();
		if (that.hitBox.x < this.hitBox.x)
		{
			overlap.x = Math.floor(that.hitBox.x + that.hitBox.w - this.hitBox.x) + 1;
		}
		else
		{
			overlap.x = Math.floor(this.hitBox.x + this.hitBox.w - that.hitBox.x) + 1;
		}
		if (that.hitBox.y < this.hitBox.y)
		{
			overlap.y = Math.floor(that.hitBox.y + that.hitBox.h - this.hitBox.y) + 1;
		}
		else
		{
			overlap.y = Math.floor(this.hitBox.y + this.hitBox.h - that.hitBox.y) + 1;
		}
		if (Math.abs(overlap.y) < Math.abs(overlap.x))
		{
			if (that.y < this.y)
			{
				that.flags.grounded = true;
				that.y -= overlap.y;
			}
			else if (that.y > this.y)
			{
				that.flags.jumping = false;
				that.y += overlap.y;
			}
		}
		else if (Math.abs(overlap.x) < Math.abs(overlap.y))
		{
			if (that.flags.onSlope)
				return;
			
			if (that.py + that.height / 2 <= this.hitBox.y)
				return;
				
			that.flags.blocked = true;
			if (that.x < this.x)
				that.x -= overlap.x;
			else if (that.x > this.x)
				that.x += overlap.x;
		}
	}
	display()
	{
		ctx.strokeStyle = 'yellow';
		ctx.strokeRect(this.hitBox.x, this.hitBox.y, this.hitBox.w, this.hitBox.h);
	}
}
class Slope {
	constructor(x, y, w, h, hasTop = true)
	{
		this.x = x;
		this.y = y;
		this.width = w;
		this.height = h;
		this.hasTop = hasTop;
		this.id = 'slope';
	}
	get hypo()
	{
		return SLine(
			this.x - this.width / 2,
			this.y - this.height / 2,
			this.x + this.width / 2,
			this.y + this.height / 2);
	}
	get area()
	{
		return [
			this.hypo.a,
			new Vec(this.hypo.a.x, this.hypo.b.y),
			this.hypo.b,
		];
	}
	collide(that)
	{
		if (this.hypo.a.y < this.hypo.b.y)
		{
			if (intersect(that.hitLines.vert, this.hypo))
			{
				that.flags.grounded = true;
				that.flags.onSlope = true;
				while (intersect(that.hitLines.vert, this.hypo))
				{
					if (that.flags.crouching)
					{
						if (this.hypo.a.x > this.hypo.b.x)
							--that.x;
						else
							++that.x;
					}
					else
					{
						--that.y;
					}
				}
				return;
			}
		}
		else if (intersect(that.hitLines.vert, this.hypo) && that.vel.y < 0)
		{
			that.flags.jumping = false;
			while (intersect(that.hitLines.vert, this.hypo))
			{
				++that.y;
			}
		}
		if (this.hypo.a.x < this.hypo.b.x)
		{
			if (that.hitLines.hori && intersect(that.hitLines.hori, this.hypo))
			{
				if (this.hypo.a.y > this.hypo.b.y)
				{
					that.flags.jumping = false;
				}
				while (intersect(that.hitLines.hori, this.hypo))
				{
					if (that.x < this.hypo.a.x)
						return;
					
					++that.x;
				}
				that.flags.blocked = true;
			}
		}
		else
		{
			if (that.hitLines.hori && intersect(that.hitLines.hori, this.hypo))
			{
				if (this.hypo.a.y > this.hypo.b.y)
				{
					that.flags.jumping = false;
				}
				while (intersect(that.hitLines.hori, this.hypo))
				{
					if (that.x > this.hypo.a.x)
						return;
					--that.x;
				}
				that.flags.blocked = true;
			}
		}
	}
	display()
	{
			ctx.strokeStyle = 'cyan';
			ctx.beginPath();
			ctx.moveTo(this.hypo.a.x, this.hypo.a.y);
			ctx.lineTo(this.hypo.b.x, this.hypo.b.y);
			ctx.stroke();
	}
}
class Rope {
	constructor(x, y, w, h)
	{
		this.x = x;
		this.y = y;
		this.width = w;
		this.height = h;
		this.id = 'slope';
	}
	get floor()
	{
	const w = (this.width === 0) ? this.width : this.width / 2;
	const h = (this.height === 0) ? this.height : this.height / 2;
		return SLine(
			this.x - w,
			this.y - h,
			this.x + w,
			this.y + h);
	}
	collide(that)
	{
		if (intersect(this.floor, that.hitLines.vert))
		{
			const prev = SLine(
				that.hitLines.vert.a.x + (that.px - that.x),
				that.hitLines.vert.a.y + (that.py - that.y),
				that.hitLines.vert.b.x + (that.px - that.x),
				that.hitLines.vert.b.y + (that.py - that.y));
			
			if (!intersect(this.floor, prev) &&
			    that.y > that.py + 1 &&
			    (!that.flags.crouching || that.flags.grounded))
			{
				that.flags.grounded = true;
				that.flags.onSlope = true;
				while (intersect(that.hitLines.vert, this.floor))
				{
					--that.y;
				}
			}
		}
	}
	display()
	{
			ctx.strokeStyle = 'magenta';
			ctx.beginPath();
			ctx.moveTo(this.floor.a.x, this.floor.a.y);
			ctx.lineTo(this.floor.b.x, this.floor.b.y);
			ctx.stroke();
	}
}
class OneWay extends Rope {
	constructor(x, y, w)
	{
		super(x, y, w, 0);
		this.id = 'one-way';
	}
	collide(that)
	{
		if (lAABB(this.floor, that.hitBox))
		{
			const prev = BRect(that.hitBox.x, that.hitBox.y + (that.py - that.y), that.hitBox.w, that.hitBox.h);
			if (!lAABB(this.floor, prev) &&
			    that.y > that.py + 1)
			{
				that.flags.grounded = true;
				while (lAABB(this.floor, that.hitBox))
				{
					--that.y;
				}
			}
		}
	}
	display()
	{
			ctx.save();
			ctx.translate(this.floor.a.x, this.floor.a.y);
			ctx.strokeStyle = 'grey';
			ctx.beginPath();
			ctx.moveTo(0, 0)
			ctx.lineTo(this.width, 0);
			ctx.stroke();
			ctx.restore();
	}
}
loadLevel(level);


/**************************
 *                        *
 *          MAIN:         *
 *                        *
 **************************/
let frame = 0;

const DebugStats = {
	FPS: Math.floor(1000 / Time.millis.inter),
	draw: function()
	{
		if (frame % 15 === 0)
		{
			this.FPS = Math.floor(1000 / Time.millis.inter);
		}
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.font = `bold ${Math.floor(meter / 2)}px sans-serif`;
		shadowText(this.FPS, 5, 4);
	},
};

const shadowText = (
	txt = `Hello, World!`,
	x = 0, y = 0,
	rgb = 'white', offset = meter / 50) =>
{
	ctx.fillStyle = 'black';
	ctx.fillText(txt, x + offset, y + offset);
	ctx.fillStyle = rgb;
	ctx.fillText(txt, x, y);
};

let scene = 'Game';
let playShot = -1;
let initScene = true;
const scenes = {
	'Game': {
		init: function() {},
		display: function()
		{
			ctx.clearRect(0, 0, width, height);
			ctx.save();
			ctx.translate(width / 2 - Camera.x, (height / 2 - Camera.y));
			ctx.fillStyle = 'black';
			ctx.fillRect(0, 0, levels[level].w * tileSize, levels[level].h * tileSize);
			for (let i = bodies.length - 1; i >= 0; --i)
			{
				if (bodies[i].flags && bodies[i].flags.dead)
						bodies.splice(i, 1);
				
				if (bodies[i].id && bodies[i].id === 'player')
				{
					Camera.track(bodies[i]);
					Camera.constrainX(bodies[i]);
				}
				bodies[i].display();
			}
			ctx.restore();
			for (const i in controls)
				controls[i].draw();
		},
	},	
};

const render = () =>
{
	window.requestAnimationFrame(render);
	Time.millis.update();
	while (Time.second >= 60)
	{
		++Time.minute;
		while (Time.minute >= 60)
		{
			++Time.hour;
			Time.minute -= 60;
		}
		Time.second -= 60;
	}
	scenes[scene].display();
	if (scenes[scene].init && initScene)
	{
		scenes[scene].init();
		initScene = false;
	}
	if (touches.every(element => !element.pressed))
	{
		clicked = false;
	}
	DebugStats.draw();
	++frame;
};
window.requestAnimationFrame(render);