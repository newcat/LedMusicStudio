use super::colors::Color;
use palette::{Blend, Hsv, LinSrgb, Mix};
use rand::rngs::SmallRng;
use rand::{Rng, SeedableRng};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
#[derive(Copy, Clone)]
pub struct Particle {
    current_lifetime: u32,
    total_lifetime: u32,
    position: f32,
    glow: f32,
    start_velocity: f32,
    end_velocity: f32,
    color: Color,
    start_color: Color,
    end_color: Color,
}

#[wasm_bindgen]
pub struct ParticleNode {
    particles: Vec<Particle>,
    particles_to_spawn: f32,
    output_buffer: Vec<Color>,
    rng: SmallRng,
}

#[wasm_bindgen]
pub struct CalculationData {
    fps: u32,
    resolution: u32,
    emit: bool,
    rate: f32,
    start_velocity: f32,
    end_velocity: f32,
    randomness: f32,
    glow: f32,
    emitter_position: f32,
    symmetric: bool,
    lifetime: f32,
    start_color: Color,
    end_color: Color,
}

#[wasm_bindgen]
impl CalculationData {
    #[wasm_bindgen(constructor)]
    pub fn new(
        fps: u32,
        resolution: u32,
        emit: bool,
        rate: f32,
        start_velocity: f32,
        end_velocity: f32,
        randomness: f32,
        glow: f32,
        emitter_position: f32,
        symmetric: bool,
        lifetime: f32,
        start_color: &[u8],
        end_color: &[u8],
    ) -> CalculationData {
        if start_color.len() != 3 || end_color.len() != 3 {
            panic!("Invalid start_color or end_color");
        }
        let mut sc = [0, 0, 0];
        sc.copy_from_slice(start_color);
        let mut ec = [0, 0, 0];
        ec.copy_from_slice(end_color);
        return CalculationData {
            fps,
            resolution,
            emit,
            rate,
            start_velocity,
            end_velocity,
            randomness,
            glow,
            emitter_position,
            symmetric,
            lifetime,
            start_color: sc,
            end_color: ec,
        };
    }
}

fn color_to_linsrgb(c: &Color) -> LinSrgb {
    return LinSrgb::new(
        c[0] as f32 / 255.0,
        c[1] as f32 / 255.0,
        c[2] as f32 / 255.0,
    );
}

fn rgb_to_color<T: palette::rgb::RgbStandard>(c: palette::rgb::Rgb<T, f32>) -> Color {
    return [
        (c.red * 255.0) as u8,
        (c.green * 255.0) as u8,
        (c.blue * 255.0) as u8,
    ];
}

#[wasm_bindgen]
impl ParticleNode {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ParticleNode {
        ParticleNode {
            particles: Vec::new(),
            particles_to_spawn: 0.0,
            output_buffer: Vec::new(),
            rng: SmallRng::from_entropy(),
        }
    }

    pub fn calculate(&mut self, calculation_data: &CalculationData) {
        for p in self.particles.as_mut_slice() {
            p.current_lifetime += 1;
        }
        self.particles.retain(|p| {
            p.current_lifetime < p.total_lifetime && p.position >= 0.0 && p.position <= 1.0
        });
        for p in self.particles.as_mut_slice() {
            let life_progress = p.current_lifetime as f32 / p.total_lifetime as f32;
            let start_color = color_to_linsrgb(&p.start_color);
            let end_color = color_to_linsrgb(&p.end_color);
            let mixed_color = rgb_to_color(start_color.mix(&end_color, life_progress));
            p.color = mixed_color;
            p.position += p.start_velocity + (p.end_velocity - p.start_velocity) * life_progress;
        }

        if calculation_data.emit {
            let rate = calculation_data.rate / calculation_data.fps as f32;
            let randomness = calculation_data.randomness / calculation_data.fps as f32;
            let start_velocity = calculation_data.start_velocity / calculation_data.fps as f32;
            let end_velocity = calculation_data.end_velocity / calculation_data.fps as f32;
            let lifetime_in_frames =
                (calculation_data.lifetime * calculation_data.fps as f32) as u32;

            self.particles_to_spawn += rate;
            while self.particles_to_spawn > 1.0 {
                let p = Particle {
                    total_lifetime: lifetime_in_frames,
                    current_lifetime: 0,
                    position: calculation_data.emitter_position,
                    glow: calculation_data.glow,
                    start_velocity: start_velocity + (2.0 * self.rng.gen::<f32>() - 1.0) * randomness,
                    end_velocity: end_velocity + (2.0 * self.rng.gen::<f32>() - 1.0) * randomness,
                    color: calculation_data.start_color,
                    start_color: calculation_data.start_color,
                    end_color: calculation_data.end_color,
                };
                self.particles.push(p);
                if calculation_data.symmetric {
                    let mut p2 = p;
                    p2.start_velocity = -p2.start_velocity;
                    p2.end_velocity = -p2.end_velocity;
                    self.particles.push(p2)
                }
                self.particles_to_spawn -= 1.0;
            }
        }

        if self.output_buffer.len() != calculation_data.resolution as usize {
            self.output_buffer = Vec::with_capacity(calculation_data.resolution as usize);
            for _i in 0..calculation_data.resolution as usize {
                self.output_buffer.push([0; 3]);
            }
        } else {
            for i in 0..calculation_data.resolution as usize {
                self.output_buffer[i] = [0, 0, 0];
            }
        }

        for p in &self.particles {
            let start = clamp(
                ((p.position - p.glow) * calculation_data.resolution as f32).floor() as i32,
                0,
                calculation_data.resolution as i32 - 1,
            ) as usize;
            let end = clamp(
                ((p.position + p.glow) * calculation_data.resolution as f32).ceil() as i32,
                0,
                calculation_data.resolution as i32 - 1,
            ) as usize;
            let particle_color = color_to_linsrgb(&p.color);
            let hsv = Hsv::from(particle_color);
            for i in start..end {
                let pos = i as f32 / calculation_data.resolution as f32;
                let intensity = clamp(linear_intensity(p.position, pos, p.glow), 0.0, 1.0);
                let mut darkened = hsv.clone();
                darkened.value *= intensity;
                let buffer_color = color_to_linsrgb(&self.output_buffer[i]);
                let result_color = rgb_to_color(LinSrgb::from(buffer_color.dodge(LinSrgb::from(darkened))));
                self.output_buffer[i] = result_color;
            }
        }
    }

    pub fn get_output_buffer(&mut self) -> Vec<u8> {
        let flat_len = self.output_buffer.len() * 3;
        let mut b: Vec<u8> = Vec::with_capacity(flat_len);
        for i in 0..self.output_buffer.len() - 1 {
            b.push(self.output_buffer[i][0]);
            b.push(self.output_buffer[i][1]);
            b.push(self.output_buffer[i][2]);
        }
        return b;
    }
}

fn clamp<T: PartialOrd>(v: T, min: T, max: T) -> T {
    if v > max {
        return max;
    } else if v < min {
        return min;
    } else {
        return v;
    }
}

fn linear_intensity(center: f32, position: f32, width: f32) -> f32 {
    if width == 0.0 {
        return 0.0;
    }
    let distance = (position - center).abs();
    return 1.0 - distance / width;
}
