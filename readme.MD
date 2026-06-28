first go to the terminal and there , do command : "pwd ", that will tell u that u are in teh main file or not .
after that command - "ls" -it will list all the files that are in the folder u can cross chek that , 
now if u see all the files there , than it is confirmed that u are at the right place 
now run command : " git status " - it will show you the files are commited not yet 
now make a repo on github and than command : "git add . " ( here if u write only this command than u will staged all the file in the folder , but if u do something like git add . src.... than u can select the file that u want to commit or add into the staged )
now command : " git status " now u will see all the files that are reay to commit in the staged quue in green color .
no command : : git commit -m "Initial commit" it takes snapshot what u have staged 
git remote add origin git@github.com:username/repo.git
make main brach :git branch -M main
now push :git push -u origin main
