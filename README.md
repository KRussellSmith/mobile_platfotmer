Mobile Platformer
=================
This is an attempt to recreate the physics of old-style platformers (e.g. Mario, Commander Keen, etc.) that I wrote back in June of 2019.
You can have the character walk or crouch with the D-pad, shoot or run with the left button, and jump with the right button.
Pressing the jump button for longer causes the character to jump higher; one-way platforms (grey) may be jumped through, ropes (magenta) may also be jumped off of via crouching. The player may slide down slopes via crouching; slopes that are too steep may not be climbed at all.
There are two basic AI creatures: one walks and turns at walls, the other does the same but also turns at the edges of platforms.
The player may shoot them, however they do not harm the character, due to the lack of a lose condition (this is only intended as a physics demo.)

Credits & Acknowledgements
--------------------------
This program makes use of James Hallidan's [point-in-polygon algorithm](https://github.com/substack/point-in-polygon).

It also uses a counterclockwise line-to-line intersection algorithm from these answers to [this Stack Overflow question](https://stackoverflow.com/q/9043805/11612001):
	https://stackoverflow.com/a/16725715/11612001
	https://stackoverflow.com/a/28866825/11612001
