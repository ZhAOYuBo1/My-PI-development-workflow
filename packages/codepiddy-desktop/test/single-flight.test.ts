import { describe, expect, test, vi } from "vitest";
import { SingleFlightMap } from "../src/main/single-flight.ts";

describe("SingleFlightMap", () => {
	test("shares one in-flight operation for the same key", async () => {
		const flights = new SingleFlightMap<string, number>();
		let resolveOperation: ((value: number) => void) | undefined;
		const operation = vi.fn(
			() =>
				new Promise<number>((resolve) => {
					resolveOperation = resolve;
				}),
		);
		const first = flights.run("agent", operation);
		const second = flights.run("agent", operation);
		expect(operation).toHaveBeenCalledTimes(1);
		resolveOperation?.(42);
		await expect(Promise.all([first, second])).resolves.toEqual([42, 42]);
	});

	test("allows retry after a failed operation", async () => {
		const flights = new SingleFlightMap<string, number>();
		await expect(flights.run("agent", async () => Promise.reject(new Error("failed")))).rejects.toThrow("failed");
		await expect(flights.run("agent", async () => 7)).resolves.toBe(7);
	});
});
