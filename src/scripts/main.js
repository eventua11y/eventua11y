document.addEventListener("DOMContentLoaded", (event) => {
  console.log("Hello from main.js");
  const filterDrawer = document.getElementById("filter-drawer");
  const openButton = document.getElementById("open-filter-drawer");
  openButton.addEventListener("click", () => filterDrawer.show());
});

// Store the initial state of the filters
// const initialFilters = {
//   cfsOpen: false,
//   cfsClosed: false,
//   attendanceOnline: false,
//   attendanceOffline: false,
//   themes: true,
//   all: false,
// };

document.addEventListener("alpine:init", () => {
  console.log("Hello from Alpine");
  Alpine.store("hello", "Hello from Alpine!");

  // Initialize the filters store with the initial state
  const initialFilters = {
    cfsOpen: false,
    cfsClosed: false,
    attendanceOnline: false,
    attendanceOffline: false,
    themes: true,
  };
  Alpine.store("filters", { ...initialFilters, initialFilters });

  // Add a method to reset the filters to the initial state
  Alpine.store("filters").reset = () => {
    const initialFilters = Alpine.store("filters").initialFilters;
    Object.keys(initialFilters).forEach((key) => {
      Alpine.store("filters")[key] = initialFilters[key];
    });
    // After resetting the filters, re-filter the events
    Alpine.store("filters").filterEvents();
  };

  Alpine.store("filters").filterEvents = () => {
    // Select all events on the page
    const events = document.querySelectorAll(".event");

    // Loop over the events
    events.forEach((event) => {
      // Get the event type, attendance mode, and cfs status
      const eventType = event.getAttribute("data-event-type");
      const eventAttendanceMode = event.getAttribute("data-event-attendancemode");
      const eventCfsStatus = event.getAttribute("data-event-cfs") !== null;

      // If the 'themes' filter is false and the event type is 'theme', hide the event
      // If the 'themes' filter is true and the event type is 'theme', show the event
      if (eventType === "theme") {
        event.style.display = Alpine.store("filters").themes ? "" : "none";
      } else {
        // Check if the event matches the attendance mode filter
        const matchesAttendanceMode = 
          (!Alpine.store("filters").attendanceOnline && !Alpine.store("filters").attendanceOffline) ||
          (Alpine.store("filters").attendanceOnline && (eventAttendanceMode === "online" || eventAttendanceMode === "mixed")) ||
          (Alpine.store("filters").attendanceOffline && (eventAttendanceMode === "offline" || eventAttendanceMode === "mixed"));

        // Check if the event matches the cfs filter
        const matchesCfs = 
          (!Alpine.store("filters").cfsOpen && !Alpine.store("filters").cfsClosed) ||
          (Alpine.store("filters").cfsOpen && eventCfsStatus) ||
          (Alpine.store("filters").cfsClosed && !eventCfsStatus);

        // If the event matches all filter criteria, show the event; otherwise, hide it
        event.style.display = (matchesAttendanceMode && matchesCfs) ? "" : "none";
      }
    });
  };
});
