To-Do Board App
A simple Trello-inspired web app for managing tasks across lists.
Built with Flask, SQLite, and a vanilla HTML/CSS/JS frontend.  

How to Run
- Clone the repository
``` git clone https://github.com/at07a/todo```  
-  Install dependencies:
```pip install -r requirements.txt```  
- Run the App
```python app.py```
- Open browser and visit
```http://127.0.0.1:5000```




Tech Used
- Backend: Python, Flask, SQLAlchemy, SQLite
- Frontend: HTML, CSS, JavaScript
- Other: Flask-CORS for API access, drag-and-drop functionality with vanilla JS  

Features
- Create, update, and delete task lists
- Add, move, and delete tasks
- Drag-and-drop tasks between lists
- Session-based data separation per user
- Instant save to database without page refresh
- FAQ page explaining the project  

License:
This project is licensed under the MIT License — free to use, modify, and distribute.

Note:
Ignore FAQ Page, this is a project for school. To remove it:

- Delete the route in app.py
Open app.py and remove or comment out the following section:

```@app.route("/faq")```
```def faq():```
```    return render_template("faq.html")```

- Remove the FAQ button from the frontend
In the templates folder (templates/index.html), find and remove the element with the class faq-button, for example:

```<a href="/faq" class="faq-button">FAQ</a>```

 - Delete the faq.html template
In the templates folder, delete faq.html.

- Remove FAQ-related CSS (optional)
In static/style.css, delete the .faq-button styles:

```.faq-button {
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: var(--accent);
    color: white;
    padding: 10px 18px;
    border-radius: 8px;
    font-weight: 500;
    text-decoration: none;
    box-shadow: var(--shadow);
    transition: background var(--time) var(--ease), transform var(--time) var(--ease);
}
.faq-button:hover {
    background: #4338ca;
    transform: translateY(-2px);
}
```

- Restart your app
After making these changes, restart the Flask server:

```python app.py```
The FAQ page will now be completely gone.
