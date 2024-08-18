export class PriorityQueue<T>{
    private items: { item: T, priority: number }[] = [];

    enqueue(item: T, priority: number) {
        const queueElement = { item, priority };
        let added = false;

        for (let i = 0; i < this.items.length; i++) {
            if (queueElement.priority < this.items[i].priority) {
                this.items.splice(i, 0, queueElement);
                added = true;
                break;
            }
        }

        if (!added) {
            this.items.push(queueElement)
        }
    }

    dequeue(): T | undefined {
        return this.items.shift()?.item;
    }

    isEmpty(): boolean {
        return this.items.length === 0;
    }

    size(): number {
        return this.items.length;
    }

    getItems(): { item: T, priority: number }[] {
        return this.items;
    }
}