document.addEventListener('DOMContentLoaded', function () {
    console.log("modal.js loaded and checking sessionStorage...");

    function showNotification(title, message, isSuccess) {
        console.log("Triggering notification:", title, message);

        const titleElement = document.getElementById('notificationTitle');
        const messageElement = document.getElementById('notificationMessage');
        const modalElement = document.getElementById('notificationModal');

        if (!titleElement || !messageElement || !modalElement) {
            console.error("Modal elements not found! Ensure the modal exists in the HTML.");
            return;
        }

        // Update title and message
        titleElement.textContent = title;
        messageElement.textContent = message;

        // Apply success/error styles
        if (isSuccess) {
            titleElement.style.color = "green";
        } else {
            titleElement.style.color = "red";
        }

        // Ensure modal is visible and triggered
        console.log("Opening modal...");
        $('#notificationModal').modal({
            fadeDuration: 250, 
            escapeClose: true,  
            clickClose: true    
        });
    }

    // Check sessionStorage for notifications
    var notification = sessionStorage.getItem('notification');
    if (notification) {
        var parsed = JSON.parse(notification);
        showNotification(parsed.title, parsed.message, parsed.isSuccess);
        sessionStorage.removeItem('notification'); // Remove after displaying
    }
});
