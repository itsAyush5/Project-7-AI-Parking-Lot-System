 const lotGrid = document.getElementById("lotGrid");
        const tableBody = document.getElementById("tableBody");

        // increase slots to 72 (more parking lots)
        let TOTAL_SLOTS = 72;
        let slots = Array(TOTAL_SLOTS).fill(null);
        let parkedVehicles = [];
        let history = [];
        let reservations = [];
        let pendingCheckin = null;
        let pendingCheckout = null;
        let expiryCheckInterval = null;

        // BOOKING DURATION CONSTANTS (in minutes)
        const BOOKING_DURATIONS = {
            1: 60,
            2: 120,
            3: 180,
            4: 240,
            6: 360,
            12: 720,
            24: 1440
        };

        // Modal Functions
        function openCheckinModal() {
            document.getElementById("checkinModal").style.display = "block";
        }

        function closeCheckinModal() {
            document.getElementById("checkinModal").style.display = "none";
            pendingCheckin = null;
        }

        function openCheckoutModal() {
            document.getElementById("checkoutModal").style.display = "block";
        }

        function closeCheckoutModal() {
            document.getElementById("checkoutModal").style.display = "none";
            pendingCheckout = null;
        }

        // Close modal when clicking outside
        window.onclick = function (event) {
            const checkinModal = document.getElementById("checkinModal");
            const checkoutModal = document.getElementById("checkoutModal");
            if (event.target === checkinModal) {
                closeCheckinModal();
            }
            if (event.target === checkoutModal) {
                closeCheckoutModal();
            }
        };

        function showAlert(message, type) {
            const alertEl = document.getElementById("alert");
            alertEl.textContent = message;
            alertEl.className = `alert ${type}`;
            alertEl.style.display = "flex";
            setTimeout(() => {
                alertEl.style.display = "none";
            }, 3000);
        }

        function showCheckoutAlert(message, type) {
            const alertEl = document.getElementById("alert-checkout");
            alertEl.textContent = message;
            alertEl.className = `alert ${type}`;
            alertEl.style.display = "flex";
            setTimeout(() => {
                alertEl.style.display = "none";
            }, 3000);
        }

        function calculateTimeRemaining(expiryTime) {
            const now = new Date();
            const timeDiff = expiryTime - now;
            const minutesRemaining = Math.round(timeDiff / 60000);
            const hoursRemaining = Math.floor(minutesRemaining / 60);

            if (minutesRemaining < 0) return { expired: true, text: "EXPIRED" };
            if (hoursRemaining > 0) return { expired: false, text: `${hoursRemaining}h ${minutesRemaining % 60}m` };
            return { expired: false, text: `${minutesRemaining}m` };
        }

        function renderSlots() {
            lotGrid.innerHTML = "";
            slots.forEach((val, i) => {
                let div = document.createElement("div");
                let isExpiring = false;
                let timeText = "";
                let isReserved = reservations.some(r => r.slotNumber === i + 1);

                if (val) {
                    const timeRemaining = calculateTimeRemaining(val.expiryTime);
                    isExpiring = timeRemaining.expired || (timeRemaining.text.includes('m') && parseInt(timeRemaining.text) <= 15);
                    timeText = timeRemaining.text;
                }

                let className = "slot";
                if (val) {
                    className = isExpiring ? "slot occupied expiring" : "slot occupied";
                } else if (isReserved) {
                    className = "slot reserved";
                }

                div.className = className;
                div.innerHTML = `
                <div class="slot-icon"><i class="fas ${val ? (val.type === 'Car' ? 'fa-car' : val.type === 'Bike' ? 'fa-motorcycle' : 'fa-truck') : isReserved ? 'fa-lock' : 'fa-parking'}"></i></div>
                <div class="slot-number">P${i + 1}</div>
                ${val && timeText ? `<div style="font-size: 11px; color: ${isExpiring ? '#fff' : '#666'}; margin-top: 3px;"><i class="fas fa-clock"></i> ${timeText}</div>` : ''}
                ${isReserved && !val ? `<div style="font-size: 10px; color: #667eea; margin-top: 3px;">RESERVED</div>` : ''}
            `;
                let tooltipText = val ? `${val.number} (${val.type})\nExpires: ${val.expiryTime.toLocaleTimeString()}` : (isReserved ? "Reserved" : "Available");
                div.title = tooltipText;
                lotGrid.appendChild(div);
            });
            updateCounts();
        }

        function updateCounts() {
            let occ = slots.filter(s => s).length;
            let reserved = reservations.length;
            let available = TOTAL_SLOTS - occ - reserved;
            document.getElementById("occupiedCount").innerText = occ;
            document.getElementById("availableCount").innerText = available;
            document.getElementById("occupancyRate").innerText = Math.round((occ / TOTAL_SLOTS) * 100) + "%";
        }

        function updateParkedList() {
            const parkedList = document.getElementById("parkedList");
            const searchEl = document.getElementById('parkedSearch');
            const searchTerm = searchEl ? searchEl.value.trim().toUpperCase() : '';

            const items = parkedVehicles.slice();
            const filtered = searchTerm ? items.filter(v => v.number.toUpperCase().includes(searchTerm)) : items;

            if (filtered.length === 0) {
                parkedList.innerHTML = '<p style="text-align: center; color: #999;">\n                <i class="fas fa-inbox"></i> No vehicles parked</p>';
                return;
            }

            parkedList.innerHTML = filtered.map((v) => {
                const timeRemaining = calculateTimeRemaining(v.expiryTime);
                const isExpired = timeRemaining.expired;
                const isExpiring = !isExpired && (timeRemaining.text.includes('m') && parseInt(timeRemaining.text) <= 15);
                const originalIdx = parkedVehicles.findIndex(p => p.number === v.number);

                return `\n                <div style="background: #f9f9f9; padding: 12px; border-radius: 8px; margin-bottom: 10px; ${isExpired ? 'border: 2px solid #ff6b6b;' : ''}" class="${isExpired ? 'vehicle-item-expiring' : ''}">\n                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">\n                        <div style="display: flex; align-items: center; gap: 8px;">\n                            <span><strong>${v.number}</strong> (${v.type}) - Slot P${v.slot}</span>\n                            ${isExpired ? `<span class="expiry-badge">⚠️ EXPIRED</span>` : ''}\n                            ${isExpiring ? `<span style="background: #ffc107; color: #000; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: bold; white-space: nowrap;\">⏰ EXPIRING SOON</span>` : ''}\n                        </div>\n                        <div style="display: flex; gap: 8px; flex-shrink: 0; margin-left: auto;">\n                            <button onclick="showPathGuidance(${v.slot})" style="background: #667eea; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; white-space: nowrap;\"><i class=\"fas fa-directions\"></i> Path</button>\n                            <button onclick="initiateCheckout(${originalIdx})" style="background: #ef4444; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; white-space: nowrap;\"><i class=\"fas fa-sign-out-alt\"></i> Checkout</button>\n                        </div>\n                    </div>\n                    <div style=\"margin-top: 8px; font-size: 13px; color: ${isExpired ? '#ff6b6b' : '#666'};\">\n                        <i class=\"fas fa-hourglass-end\"></i> ${isExpired ? 'Booking expired' : `Expires in: ${timeRemaining.text}`}\n                    </div>\n                </div>\n            `;
            }).join('');
        }

        function checkInVehicle() {
            let number = document.getElementById("vehicleNumber").value.trim().toUpperCase();
            let type = document.getElementById("vehicleType").value;
            let duration = parseInt(document.getElementById("bookingDuration").value);

            if (!number) {
                showAlert("Please enter a vehicle number!", "error");
                return;
            }

            if (!duration || duration < 1 || duration > 24) {
                showAlert("Please enter a valid booking duration (1-24 hours)!", "error");
                return;
            }

            // Check for duplicate
            if (parkedVehicles.some(v => v.number === number)) {
                showAlert("Vehicle already parked!", "error");
                return;
            }

            let index = slots.findIndex(s => s === null);
            if (index === -1) {
                showAlert("Parking lot is full!", "error");
                return;
            }

            // Calculate expiry time
            const checkInTime = new Date();
            const expiryTime = new Date(checkInTime.getTime() + duration * 60 * 60 * 1000);

            // Store pending checkin and show confirmation modal
            pendingCheckin = { number, type, index, checkInTime, expiryTime, duration };
            document.getElementById("confirmVehicleNumber").textContent = number;
            document.getElementById("confirmVehicleType").textContent = type;
            document.getElementById("confirmSlotNumber").textContent = "P" + (index + 1);
            document.getElementById("confirmCheckInTime").textContent = checkInTime.toLocaleTimeString();
            document.getElementById("confirmBookingDuration").textContent = duration + " hour(s)";
            document.getElementById("confirmExpiryTime").textContent = expiryTime.toLocaleTimeString();

            openCheckinModal();
        }

        function confirmCheckin() {
            if (!pendingCheckin) return;

            const { number, type, index, checkInTime, expiryTime, duration } = pendingCheckin;

            slots[index] = { number, type, checkInTime, expiryTime, duration };
            parkedVehicles.push({ number, type, slot: index + 1, time: checkInTime.toLocaleTimeString(), expiryTime, duration });

            history.push([index + 1, number, type, duration + "h"]);

            tableBody.innerHTML = history.map(h => `
            <tr>
                <td><strong>P${h[0]}</strong></td>
                <td>${h[1]}</td>
                <td>${h[2]}</td>
                <td>${h[3]}</td>
            </tr>
        `).join("");

            document.getElementById("vehicleNumber").value = "";
            document.getElementById("bookingDuration").value = "2";
            showAlert(`Vehicle ${number} successfully checked in at slot P${index + 1}! Expires in ${duration} hour(s).`, "success");
            closeCheckinModal();
            renderSlots();
            updateParkedList();
            startExpiryChecks();
        }

        function initiateCheckout(idx) {
            let vehicle = parkedVehicles[idx];

            // Store pending checkout
            pendingCheckout = { vehicle, idx };

            // Calculate duration
            const entryTime = new Date(vehicle.time);
            const now = new Date();
            const durationMinutes = Math.round((now - entryTime) / 60000);
            const durationHours = Math.round(durationMinutes / 60) || 0;

            document.getElementById("confirmCheckoutVehicle").textContent = vehicle.number;
            document.getElementById("confirmCheckoutType").textContent = vehicle.type;
            document.getElementById("confirmCheckoutSlot").textContent = "P" + vehicle.slot;
            document.getElementById("confirmCheckoutDuration").textContent = durationHours > 0 ? durationHours + " hour(s)" : durationMinutes + " minute(s)";

            openCheckoutModal();
        }

        function checkOutVehicle() {
            let number = document.getElementById("checkoutNumber").value.trim().toUpperCase();

            if (!number) {
                showCheckoutAlert("Please enter a vehicle number!", "error");
                return;
            }

            let vehicleIdx = parkedVehicles.findIndex(v => v.number === number);
            if (vehicleIdx === -1) {
                showCheckoutAlert("Vehicle not found!", "error");
                return;
            }

            let vehicle = parkedVehicles[vehicleIdx];
            pendingCheckout = { vehicle, idx: vehicleIdx };

            // Calculate duration
            const durationMinutes = Math.round((new Date() - new Date(vehicle.time)) / 60000);
            const durationHours = Math.round(durationMinutes / 60) || 0;

            document.getElementById("confirmCheckoutVehicle").textContent = vehicle.number;
            document.getElementById("confirmCheckoutType").textContent = vehicle.type;
            document.getElementById("confirmCheckoutSlot").textContent = "P" + vehicle.slot;
            document.getElementById("confirmCheckoutDuration").textContent = durationHours > 0 ? durationHours + " hour(s)" : durationMinutes + " minute(s)";

            openCheckoutModal();
        }

        function confirmCheckout() {
            if (!pendingCheckout) return;

            let vehicle = pendingCheckout.vehicle;
            let vehicleIdx = pendingCheckout.idx;

            let slotIdx = slots.findIndex(s => s && s.number === vehicle.number);
            if (slotIdx !== -1) {
                slots[slotIdx] = null;
            }

            parkedVehicles.splice(vehicleIdx, 1);
            document.getElementById("checkoutNumber").value = "";
            showCheckoutAlert(`Vehicle ${vehicle.number} successfully checked out from slot P${slotIdx + 1}!`, "success");
            closeCheckoutModal();
            renderSlots();
            updateParkedList();
        }

        function startExpiryChecks() {
            // Clear existing interval if any
            if (expiryCheckInterval) {
                clearInterval(expiryCheckInterval);
            }

            // Check every 10 seconds
            expiryCheckInterval = setInterval(() => {
                const now = new Date();

                // Check for expired bookings
                parkedVehicles.forEach((vehicle, idx) => {
                    if (vehicle.expiryTime <= now && !vehicle.notified) {
                        vehicle.notified = true;
                        showAlert(`Booking for ${vehicle.number} has EXPIRED!`, "error");
                    }
                });

                // Update UI
                renderSlots();
                updateParkedList();
            }, 10000);
        }

        // wire up search input
        const parkedSearchEl = document.getElementById('parkedSearch');
        if (parkedSearchEl) {
            parkedSearchEl.addEventListener('input', () => {
                updateParkedList();
            });
        }

        function showPathGuidance(slotNumber) {
            // Clear any previous path highlighting
            document.querySelectorAll('.slot').forEach(s => {
                s.classList.remove('path-row', 'path-target');
            });

            // Highlight the entire row to the target slot
            const slotsPerRow = 8; // Assuming 72 slots in a grid, 8 columns
            const targetIndex = slotNumber - 1;
            const targetRow = Math.floor(targetIndex / slotsPerRow);

            // Highlight all slots in the row
            const allSlots = document.querySelectorAll('.slot');
            for (let i = 0; i < allSlots.length; i++) {
                const slotRow = Math.floor(i / slotsPerRow);
                if (slotRow === targetRow) {
                    allSlots[i].classList.add('path-row');
                }
            }

            // Highlight the target slot
            if (allSlots[targetIndex]) {
                allSlots[targetIndex].classList.remove('path-row');
                allSlots[targetIndex].classList.add('path-target');
            }

            // Show entrance indicator
            const lotGrid = document.getElementById('lotGrid');
            const existingIndicator = lotGrid.parentElement.querySelector('.entrance-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }

            const indicator = document.createElement('div');
            indicator.className = 'entrance-indicator';
            indicator.innerHTML = `<i class="fas fa-map-marker-alt"></i> ENTRANCE → Slot P${slotNumber} (Row ${targetRow + 1})`;
            lotGrid.parentElement.insertBefore(indicator, lotGrid);

            // Auto-clear after 5 seconds
            setTimeout(() => {
                document.querySelectorAll('.slot').forEach(s => {
                    s.classList.remove('path-row', 'path-target');
                });
                const indicator = lotGrid.parentElement.querySelector('.entrance-indicator');
                if (indicator) indicator.remove();
            }, 5000);
        }

        function switchTab(tabIndex, element) {
            // Hide all tabs
            document.querySelectorAll(".tab-content").forEach(el => el.style.display = "none");
            // Show selected tab
            document.getElementById(`tab-content-${tabIndex}`).style.display = "block";
            // Update active tab
            document.querySelectorAll(".tab").forEach(el => el.classList.remove("active"));
            element.classList.add("active");
            // Update reservations list when switching to reserve tab
            if (tabIndex === 3) {
                updateReservationsList();
            }
        }

        function uploadImage() {
            alert("📷 Image recognition feature coming soon!");
        }

        function reserveSlot() {
            const slotNum = parseInt(document.getElementById("reserveSlotNumber").value);
            const name = document.getElementById("reserveName").value.trim();
            const phone = document.getElementById("reservePhone").value.trim();
            const alertEl = document.getElementById("alert-reserve");

            if (!slotNum || slotNum < 1 || slotNum > TOTAL_SLOTS) {
                alertEl.style.display = "block";
                alertEl.innerHTML = `Please enter a valid slot number (1-${TOTAL_SLOTS})`;
                return;
            }

            if (!name) {
                alertEl.style.display = "block";
                alertEl.innerHTML = "Please enter your name or contact";
                return;
            }

            if (!phone) {
                alertEl.style.display = "block";
                alertEl.innerHTML = "Please enter a phone number";
                return;
            }

            // Check if slot is already occupied or reserved
            if (slots[slotNum - 1]) {
                alertEl.style.display = "block";
                alertEl.innerHTML = "Slot is already occupied!";
                return;
            }

            if (reservations.some(r => r.slotNumber === slotNum)) {
                alertEl.style.display = "block";
                alertEl.innerHTML = "Slot is already reserved!";
                return;
            }

            // Create reservation
            const reservation = {
                slotNumber: slotNum,
                name: name,
                phone: phone,
                time: new Date(),
                reservedUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
            };

            reservations.push(reservation);
            alertEl.style.display = "block";
            alertEl.innerHTML = `Slot P${slotNum} reserved successfully for ${name}!`;
            alertEl.style.backgroundColor = "#d4edda";
            alertEl.style.color = "#155724";

            document.getElementById("reserveSlotNumber").value = "";
            document.getElementById("reserveName").value = "";
            document.getElementById("reservePhone").value = "";

            renderSlots();
            updateReservationsList();
        }

        function releaseReservation(slotNumber) {
            reservations = reservations.filter(r => r.slotNumber !== slotNumber);
            showAlert(`Reservation for slot P${slotNumber} released!`, "success");
            renderSlots();
            updateReservationsList();
        }

        function updateReservationsList() {
            const listEl = document.getElementById("reservationsList");

            if (reservations.length === 0) {
                listEl.innerHTML = `<p style="text-align: center; color: #999;"><i class="fas fa-inbox"></i> No active reservations</p>`;
                return;
            }

            listEl.innerHTML = reservations.map(r => `
                <div class="vehicle-item" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-left: 4px solid #667eea; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="color: white;">
                            <strong style="font-size: 16px;"><i class="fas fa-lock"></i> Slot P${r.slotNumber}</strong><br>
                            <small>Name: ${r.name}</small><br>
                            <small><i class="fas fa-phone"></i> Phone: ${r.phone}</small><br>
                            <small>Reserved: ${r.time.toLocaleTimeString()}</small><br>
                            <small>Until: ${r.reservedUntil.toLocaleTimeString()}</small>
                        </div>
                        <button class="btn-confirm no" style="background: white; color: #667eea; padding: 8px 12px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600;" onclick="releaseReservation(${r.slotNumber})"><i class="fas fa-trash"></i> Release</button>
                    </div>
                </div>
            `).join("");
        }

        renderSlots();
        updateParkedList();
        startExpiryChecks();