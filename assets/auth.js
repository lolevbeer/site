new Vue({
    el: '#app',
    delimiters: ['${', '}'],
    data() {
        return {
            inventory: [],
            password: localStorage.getItem('password') || ''
        };
    },
    async mounted() {
        if (this.password) {
            await this.loadInventory();
        } else {
            this.promptPassword();
        }
    },
    methods: {
        promptPassword() {
            const password = localStorage.getItem('password');
            if (password) {
                this.password = password;
                this.loadInventory();
            } else {
                mscPrompt('Enter password', (enteredPassword) => {
                    this.password = enteredPassword;
                    localStorage.setItem('password', enteredPassword);
                    this.loadInventory();
                });
            }
        },
        async loadInventory() {
            try {
                const response = await axios.get(`https://docs.google.com/spreadsheets/d/e/2PACX-1vQIcKPeDcvTKS_7zH7-XekKAuO3cl7juVJOy3upThDIM2nnca7WKrXpYIC8oBebXDMM35hstr${this.password}/pub?gid=0&single=true&output=csv`);
                const parsedData = Papa.parse(response.data, { header: true }).data;
                this.inventory = parsedData;
                this.$nextTick(() => {
                    this.addEventListeners(); // Bind event listeners after setting inventory data
                });
            } catch (error) {
                mscAlert('Incorrect');
                localStorage.removeItem('password');
                this.promptPassword();
            }
        },
        addEventListeners() {
            const rowControlElements = document.querySelectorAll('.row-control');
            rowControlElements.forEach(element => {
                element.addEventListener('click', this.handleRowControlClick);
            });
        },
        handleRowControlClick(event) {
            console.log("clicked");
            const tr = event.currentTarget.closest('tr');
            tr.classList.toggle('open');
        }
    }
});