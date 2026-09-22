async function loadActivityData() {
    try {
        const response = await fetch("http://localhost:3000/api/activity-data");

        if (!response.ok) {
            throw new Error("Failed to fetch data");
        }

        const data = await response.json();

        console.log(data.rows);

    } catch (error) {
        console.error("Error:", error);
    }
}

loadActivityData();