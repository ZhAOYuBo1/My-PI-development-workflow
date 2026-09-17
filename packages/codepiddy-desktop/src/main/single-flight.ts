export class SingleFlightMap<Key, Value> {
	private readonly pending = new Map<Key, Promise<Value>>();

	run(key: Key, operation: () => Promise<Value>): Promise<Value> {
		const existing = this.pending.get(key);
		if (existing) return existing;
		const started = operation();
		this.pending.set(key, started);
		const clear = (): void => {
			if (this.pending.get(key) === started) this.pending.delete(key);
		};
		void started.then(clear, clear);
		return started;
	}
}
