<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\BusinessLog>
 */
class BusinessLogFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'origin' => $this->faker->word(),
            'event_type' => $this->faker->randomElement(['create', 'update', 'delete', 'login', 'logout']),
            'module' => $this->faker->word(),
            'description' => $this->faker->sentence(),
            'affected_entity_type' => $this->faker->word(),
            'affected_entity_id' => $this->faker->randomNumber(),
            'user_login_id' => $this->faker->numberBetween(1, 10), // Assumes an existing user_login_id.
            'context_data' => $this->faker->text(),
        ];
    }
}